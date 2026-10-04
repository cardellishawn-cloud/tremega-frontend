// src/services/activity-store.js
// Persistence for job-site activity log entries (activity_log table).
// Same cached-but-retryable Supabase/memory strategy + schema-adaptive
// inserts as checkins-store (see pg-adapt.js for why).

const { v4: uuidv4 } = require('uuid');
const { looksLikeMissingTable, insertAdaptive } = require('./pg-adapt');

const RETRY_AFTER_MS = 60 * 1000;
const TABLE = 'activity_log';
const MEMORY_CAP = 1000;

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
      `activity-store: ${op} falling back to in-memory store (${error.message}). `
      + 'Will retry Supabase periodically.',
    );
  }
};

const memoryRows = [];

const memoryWrite = (row) => {
  memoryRows.push(row);
  if (memoryRows.length > MEMORY_CAP) memoryRows.shift();
  return row;
};

const memoryList = ({ projectId, limit = 100 }) => {
  let rows = memoryRows;
  if (projectId) rows = rows.filter((r) => r.project_id === projectId);
  return rows.slice(-limit).reverse();
};

// Insert an activity entry. Never throws — falls back to memory.
const create = async ({ project_id, crew_member_id, activity, hours }) => {
  const record = {
    id: uuidv4(),
    project_id: project_id || null,
    crew_member_id: crew_member_id || null,
    activity,
    hours: hours !== undefined ? hours : null,
    created_at: new Date().toISOString(),
  };

  if (shouldTrySupabase()) {
    try {
      const result = await insertAdaptive(getSupabase(), TABLE, record);
      if (result.ok) {
        if (result.stripped.length > 0) {
          console.warn(
            `activity-store: live schema lacks column(s) [${result.stripped.join(', ')}]; `
            + 'inserted without them.',
          );
        }
        return { record, persisted: true };
      }
      if (result.missingTable) {
        enterMemoryMode('create', result.error);
      } else {
        console.warn(`activity-store: supabase insert failed (${result.error.message}); using memory`);
      }
      return { record: memoryWrite(record), persisted: false };
    } catch (err) {
      enterMemoryMode('create', err);
      return { record: memoryWrite(record), persisted: false };
    }
  }
  return { record: memoryWrite(record), persisted: false };
};

const list = async ({ projectId, limit = 100 } = {}) => {
  if (shouldTrySupabase()) {
    try {
      let query = getSupabase().from(TABLE).select('*');
      if (projectId) query = query.eq('project_id', projectId);
      query = query.order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await query;
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('list', error);
          return memoryList({ projectId, limit });
        }
        console.warn(`activity-store: supabase list failed (${error.message}); using memory`);
        return memoryList({ projectId, limit });
      }
      return data || [];
    } catch (err) {
      enterMemoryMode('list', err);
      return memoryList({ projectId, limit });
    }
  }
  return memoryList({ projectId, limit });
};

const _clearMemory = () => memoryRows.splice(0, memoryRows.length);

module.exports = {
  create,
  list,
  setSupabase,
  _clearMemory,
};
