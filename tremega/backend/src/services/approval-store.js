// src/services/approval-store.js
// Single owner of approval persistence for approval-gated agent tools.
//
// Backend strategy: Supabase (tool_approvals table) when it exists, otherwise
// an in-memory Map. The detection is cached-but-retryable: once a "missing
// table" error is seen we serve from memory, but after RETRY_AFTER_MS we try
// Supabase again — so when migrations 007-010 land the store picks the table
// up automatically with no code change or restart dependency.

const { v4: uuidv4 } = require('uuid');
const { insertAdaptive, updateAdaptive } = require('./pg-adapt');

const RETRY_AFTER_MS = 60 * 1000;
const TABLE = 'tool_approvals';

// ---------- Injectable / lazy Supabase ----------

let supabaseClient = null;
let supabaseLoadAttempted = false;

// Tests inject a mock here; registry.setSupabase propagates to this too.
const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
  // New client — re-probe backend on next operation.
  memoryModeSince = null;
};

const getSupabase = () => {
  if (!supabaseLoadAttempted) {
    supabaseLoadAttempted = true;
    try {
      // eslint-disable-next-line global-require
      supabaseClient = require('../../lib/supabase');
    } catch (err) {
      supabaseClient = null;
    }
  }
  return supabaseClient;
};

// ---------- Backend detection (cached-but-retryable) ----------

let memoryModeSince = null; // timestamp of when we last fell back to memory

const looksLikeMissingTable = (error) =>
  Boolean(
    error
      && error.message
      // Missing-table errors AND bad/dead credentials both mean "Supabase is
      // not usable right now" — fall back to memory (cached-but-retryable).
      && /does not exist|could not find|schema cache|42P01|relation|unregistered|401|invalid.*(api )?key/i.test(error.message),
  );

// Returns true when the next operation should attempt Supabase.
const shouldTrySupabase = () => {
  if (!getSupabase()) return false;
  if (memoryModeSince === null) return true;
  if (Date.now() - memoryModeSince > RETRY_AFTER_MS) {
    memoryModeSince = null; // retry window elapsed — probe again
    return true;
  }
  return false;
};

const enterMemoryMode = (op, error) => {
  const firstTime = memoryModeSince === null;
  memoryModeSince = Date.now();
  if (firstTime) {
    console.warn(
      `approval-store: ${op} falling back to in-memory store (${error.message}). `
      + 'Will retry Supabase periodically.',
    );
  }
};

// ---------- In-memory fallback ----------

const memoryApprovals = new Map();

const memoryCreate = (record) => {
  memoryApprovals.set(record.id, record);
  return record;
};

const memoryGet = (id) => memoryApprovals.get(id) || null;

const memoryList = ({ projectId, status, limit = 200 }) => {
  let rows = Array.from(memoryApprovals.values());
  if (projectId) rows = rows.filter((r) => r.project_id === projectId);
  if (status) rows = rows.filter((r) => r.status === status);
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows.slice(0, limit);
};

const memoryUpdate = (id, patch) => {
  const existing = memoryApprovals.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  memoryApprovals.set(id, updated);
  return updated;
};

// ---------- Public API ----------

// Create a pending approval record. Always returns the record (with id) —
// never throws, so gated tool executors can always surface an approval_id.
const create = async ({ tool_name, input, summary, project_id, requested_by }) => {
  const resourceType = (input && input.order_id) ? 'order'
    : (input && input.bid_id) ? 'bid' : null;
  const resourceId = (input && (input.order_id || input.bid_id)) || null;
  const record = {
    id: uuidv4(),
    project_id: project_id || (input && input.project_id) || null,
    tool_name,
    // Dual-write legacy live columns (action_type/resource_*) alongside the
    // 009+ schema — insertAdaptive strips whichever half the table lacks.
    action_type: tool_name,
    resource_type: resourceType,
    resource_id: resourceId,
    input: input || {},
    summary: summary || null,
    status: 'pending',
    requested_by: requested_by || null,
    decided_by: null,
    decided_at: null,
    reason: null,
    result: null,
    created_at: new Date().toISOString(),
  };

  if (shouldTrySupabase()) {
    try {
      // Adaptive insert: strips columns the live (pre-migration) table
      // doesn't have yet — persists instead of falling back wholesale.
      const result = await insertAdaptive(getSupabase(), TABLE, record);
      if (!result.ok) {
        if (looksLikeMissingTable(result.error)) {
          enterMemoryMode('create', result.error);
        } else {
          console.warn(`approval-store: supabase insert failed (${result.error && result.error.message}); using memory`);
        }
        return memoryCreate(record);
      }
      return record;
    } catch (err) {
      enterMemoryMode('create', err);
      return memoryCreate(record);
    }
  }
  return memoryCreate(record);
};

const get = async (id) => {
  if (shouldTrySupabase()) {
    try {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .select('*')
        .eq('id', id)
        .single();
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('get', error);
          return memoryGet(id);
        }
        // e.g. PGRST116 "no rows" — treat as not found.
        return null;
      }
      return data || null;
    } catch (err) {
      enterMemoryMode('get', err);
      return memoryGet(id);
    }
  }
  return memoryGet(id);
};

const list = async ({ projectId, status, limit = 200 } = {}) => {
  if (shouldTrySupabase()) {
    try {
      let query = getSupabase().from(TABLE).select('*');
      if (projectId) query = query.eq('project_id', projectId);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await query;
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('list', error);
          return memoryList({ projectId, status, limit });
        }
        console.warn(`approval-store: supabase list failed (${error.message}); using memory`);
        return memoryList({ projectId, status, limit });
      }
      return data || [];
    } catch (err) {
      enterMemoryMode('list', err);
      return memoryList({ projectId, status, limit });
    }
  }
  return memoryList({ projectId, status, limit });
};

// Apply a partial update; returns the updated record or null when not found.
const update = async (id, patch) => {
  if (shouldTrySupabase()) {
    try {
      const result = await updateAdaptive(
        getSupabase(), TABLE, patch, [{ col: 'id', val: id }], { selectSingle: true },
      );
      if (!result.ok) {
        if (result.error && looksLikeMissingTable(result.error)) {
          enterMemoryMode('update', result.error);
          return memoryUpdate(id, patch);
        }
        return null;
      }
      return result.data || null;
    } catch (err) {
      enterMemoryMode('update', err);
      return memoryUpdate(id, patch);
    }
  }
  return memoryUpdate(id, patch);
};

// Compare-and-set: transition an approval from status `from`, applying patch.
// Returns the updated record, or null when the approval is not in `from`
// status (already decided / not found) — so two concurrent approvers can
// never both succeed. The memory path does the check+set synchronously
// (atomic in Node's event loop); the Supabase path relies on the
// `.eq('status', from)` guard matching zero rows on a lost race.
const transition = async (id, from, patch) => {
  if (shouldTrySupabase()) {
    try {
      const result = await updateAdaptive(
        getSupabase(),
        TABLE,
        patch,
        [{ col: 'id', val: id }, { col: 'status', val: from }],
        { selectSingle: true },
      );
      if (!result.ok) {
        if (result.error && looksLikeMissingTable(result.error)) {
          enterMemoryMode('transition', result.error);
          return memoryTransition(id, from, patch);
        }
        return null; // no row matched (lost the race or not found)
      }
      return result.data || null;
    } catch (err) {
      enterMemoryMode('transition', err);
      return memoryTransition(id, from, patch);
    }
  }
  return memoryTransition(id, from, patch);
};

const memoryTransition = (id, from, patch) => {
  const existing = memoryApprovals.get(id);
  if (!existing || existing.status !== from) return null;
  const updated = { ...existing, ...patch };
  memoryApprovals.set(id, updated);
  return updated;
};

// Test helper: wipe the in-memory store.
const _clearMemory = () => memoryApprovals.clear();

module.exports = {
  create,
  get,
  list,
  update,
  transition,
  setSupabase,
  _clearMemory,
};
