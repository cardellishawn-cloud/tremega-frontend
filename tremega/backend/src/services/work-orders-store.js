// src/services/work-orders-store.js
// Work-order persistence for the Phase 2 contractor workflow
// (assigned -> in_progress -> completed; GPS check-ins ride the existing
// /api/checkins route with project_id = work_order id).
//
// Supabase-first (work_orders, db/migrations/014_work_orders.sql) with
// in-memory fallback until the migration lands — cached-but-retryable,
// same pattern as approval-store: once a missing-table error is seen we
// serve from memory but retry Supabase after RETRY_AFTER_MS, so the store
// picks the table up automatically once migration 014 is applied.

const { v4: uuidv4 } = require('uuid');
const { insertAdaptive, updateAdaptive } = require('./pg-adapt');

const RETRY_AFTER_MS = 60 * 1000;
const TABLE = 'work_orders';

// ---------- Injectable / lazy Supabase ----------

let supabaseClient = null;
let supabaseLoadAttempted = false;

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

let memoryModeSince = null;

const looksLikeMissingTable = (error) =>
  Boolean(
    error
      && error.message
      && /does not exist|could not find|schema cache|42P01|relation|unregistered|401|invalid.*(api )?key|PGRST205/i.test(error.message),
  );

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
      `work-orders-store: ${op} falling back to in-memory store (${error.message}). `
      + 'Will retry Supabase periodically.',
    );
  }
};

// ---------- In-memory fallback ----------

const memoryOrders = new Map();

const memoryCreate = (record) => {
  memoryOrders.set(record.id, record);
  return record;
};

const memoryGet = (id) => memoryOrders.get(id) || null;

const memoryList = ({ contractorId, status, limit = 100 }) => {
  let rows = Array.from(memoryOrders.values());
  if (contractorId) rows = rows.filter((r) => r.contractor_id === contractorId);
  if (status) rows = rows.filter((r) => r.status === status);
  rows.sort((a, b) => (a.created_at < b.created_at ? 1 : -1));
  return rows.slice(0, limit);
};

const memoryTransition = (id, from, patch) => {
  const existing = memoryOrders.get(id);
  if (!existing || existing.status !== from) return null;
  const updated = { ...existing, ...patch };
  memoryOrders.set(id, updated);
  return updated;
};

// ---------- Public API ----------

const create = async ({ contractor_id, title, description, job_address }) => {
  const now = new Date().toISOString();
  const record = {
    id: uuidv4(),
    contractor_id,
    title,
    description: description || null,
    job_address: job_address || null,
    status: 'assigned',
    start_time: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
  };

  if (shouldTrySupabase()) {
    try {
      // Adaptive insert strips columns the live table lacks (pre-migration
      // or drift) — persists instead of falling back wholesale.
      const result = await insertAdaptive(getSupabase(), TABLE, record);
      if (!result.ok) {
        if (looksLikeMissingTable(result.error)) {
          enterMemoryMode('create', result.error);
        } else {
          console.warn(`work-orders-store: supabase insert failed (${result.error && result.error.message}); using memory`);
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
        return null; // PGRST116 "no rows" and friends
      }
      return data || null;
    } catch (err) {
      enterMemoryMode('get', err);
      return memoryGet(id);
    }
  }
  return memoryGet(id);
};

const list = async ({ contractorId, status, limit = 100 } = {}) => {
  if (shouldTrySupabase()) {
    try {
      let query = getSupabase().from(TABLE).select('*');
      if (contractorId) query = query.eq('contractor_id', contractorId);
      if (status) query = query.eq('status', status);
      query = query.order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await query;
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('list', error);
        } else {
          console.warn(`work-orders-store: supabase list failed (${error.message}); using memory`);
        }
        return memoryList({ contractorId, status, limit });
      }
      return data || [];
    } catch (err) {
      enterMemoryMode('list', err);
      return memoryList({ contractorId, status, limit });
    }
  }
  return memoryList({ contractorId, status, limit });
};

// Compare-and-set transition: patch is applied only when the row is still
// in status `from` (same CAS idiom as approval-store.transition).
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
        return null; // no row matched (lost race or not found)
      }
      return result.data || null;
    } catch (err) {
      enterMemoryMode('transition', err);
      return memoryTransition(id, from, patch);
    }
  }
  return memoryTransition(id, from, patch);
};

// Test helper: wipe the in-memory store.
const _clearMemory = () => memoryOrders.clear();

module.exports = {
  create,
  get,
  list,
  transition,
  setSupabase,
  _clearMemory,
};
