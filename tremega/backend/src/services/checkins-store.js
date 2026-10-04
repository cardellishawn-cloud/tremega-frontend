// src/services/checkins-store.js
// Persistence for crew GPS check-ins.
//
// Backend strategy mirrors approval-store: Supabase (checkins table) when
// reachable, in-memory Map otherwise — cached-but-retryable. Because the live
// checkins schema could not be probed (invalid API key in .env at build
// time), inserts go through insertAdaptive, which strips columns the live
// table rejects instead of failing the check-in.

const { v4: uuidv4 } = require('uuid');
const { looksLikeMissingTable, insertAdaptive } = require('./pg-adapt');

const RETRY_AFTER_MS = 60 * 1000;
const TABLE = 'checkins';

// ---------- Injectable / lazy Supabase ----------

let supabaseClient = null;
let supabaseLoadAttempted = false;

const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
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

let memoryModeSince = null;

const shouldTrySupabase = () => {
  if (!getSupabase()) return false;
  if (memoryModeSince === null) return true;
  if (Date.now() - memoryModeSince > RETRY_AFTER_MS) {
    memoryModeSince = null;
    return true;
  }
  return false;
};

const enterMemoryMode = (op, error) => {
  const firstTime = memoryModeSince === null;
  memoryModeSince = Date.now();
  if (firstTime) {
    console.warn(
      `checkins-store: ${op} falling back to in-memory store (${error.message}). `
      + 'Will retry Supabase periodically.',
    );
  }
};

// ---------- In-memory fallback ----------

const memoryCheckins = new Map();

const memoryCreate = (record) => {
  memoryCheckins.set(record.id, record);
  return record;
};

const memoryGet = (id) => memoryCheckins.get(id) || null;

const memoryList = ({ projectId, workerId, limit = 100 }) => {
  let rows = Array.from(memoryCheckins.values());
  if (projectId) rows = rows.filter((r) => r.project_id === projectId);
  if (workerId) rows = rows.filter((r) => r.worker_id === workerId);
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows.slice(0, limit);
};

const memoryUpdate = (id, patch) => {
  const existing = memoryCheckins.get(id);
  if (!existing) return null;
  const updated = { ...existing, ...patch };
  memoryCheckins.set(id, updated);
  return updated;
};

// ---------- Public API ----------

// Persist a check-in. Fields beyond the canonical set are preserved on the
// returned record; the Supabase insert adapts to the live columns. Never
// throws — falls back to memory on any failure.
const create = async ({
  worker_id,
  project_id,
  lat,
  lng,
  accuracy_m,
  verified,
  distance_m,
  confidence,
  verification_status,
  flagged,
  note,
}) => {
  const record = {
    id: uuidv4(),
    worker_id: worker_id || null,
    project_id: project_id || null,
    lat: lat !== undefined ? lat : null,
    lng: lng !== undefined ? lng : null,
    accuracy_m: accuracy_m !== undefined ? accuracy_m : null,
    verified: verified !== undefined ? verified : null,
    distance_m: distance_m !== undefined ? distance_m : null,
    confidence: confidence || null,
    verification_status: verification_status || null,
    flagged: Boolean(flagged),
    note: note || null,
    created_at: new Date().toISOString(),
  };

  if (shouldTrySupabase()) {
    try {
      const result = await insertAdaptive(getSupabase(), TABLE, record);
      if (result.ok) {
        if (result.stripped.length > 0) {
          console.warn(
            `checkins-store: live schema lacks column(s) [${result.stripped.join(', ')}]; `
            + 'inserted without them.',
          );
        }
        return record;
      }
      if (result.missingTable) {
        enterMemoryMode('create', result.error);
      } else {
        console.warn(`checkins-store: supabase insert failed (${result.error.message}); using memory`);
      }
      return memoryCreate(record);
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
        return null; // e.g. PGRST116 no rows
      }
      return data || null;
    } catch (err) {
      enterMemoryMode('get', err);
      return memoryGet(id);
    }
  }
  return memoryGet(id);
};

const list = async ({ projectId, workerId, limit = 100 } = {}) => {
  if (shouldTrySupabase()) {
    try {
      let query = getSupabase().from(TABLE).select('*');
      if (projectId) query = query.eq('project_id', projectId);
      if (workerId) query = query.eq('worker_id', workerId);
      query = query.order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await query;
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('list', error);
          return memoryList({ projectId, workerId, limit });
        }
        console.warn(`checkins-store: supabase list failed (${error.message}); using memory`);
        return memoryList({ projectId, workerId, limit });
      }
      return data || [];
    } catch (err) {
      enterMemoryMode('list', err);
      return memoryList({ projectId, workerId, limit });
    }
  }
  return memoryList({ projectId, workerId, limit });
};

const update = async (id, patch) => {
  if (shouldTrySupabase()) {
    try {
      const { data, error } = await getSupabase()
        .from(TABLE)
        .update(patch)
        .eq('id', id)
        .select()
        .single();
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('update', error);
          return memoryUpdate(id, patch);
        }
        return null;
      }
      return data || null;
    } catch (err) {
      enterMemoryMode('update', err);
      return memoryUpdate(id, patch);
    }
  }
  return memoryUpdate(id, patch);
};

// Test helper: wipe the in-memory store.
const _clearMemory = () => memoryCheckins.clear();

module.exports = {
  create,
  get,
  list,
  update,
  setSupabase,
  _clearMemory,
};
