// src/services/audit-log.js
// Audit trail for tool executions and approval decisions.
// Same cached-but-retryable backend strategy as approval-store: Supabase
// (tool_audit_log) when the table exists, in-memory array otherwise.

const { v4: uuidv4 } = require('uuid');

const RETRY_AFTER_MS = 60 * 1000;
const TABLE = 'tool_audit_log';
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

const looksLikeMissingTable = (error) =>
  Boolean(
    error
      && error.message
      && /does not exist|could not find|schema cache|42P01|relation/i.test(error.message),
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
      `audit-log: ${op} falling back to in-memory store (${error.message}). `
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

const memoryList = ({ projectId, limit }) => {
  let rows = memoryRows;
  if (projectId) rows = rows.filter((r) => r.project_id === projectId);
  return rows.slice(-limit).reverse();
};

// Best-effort write — never throws. entry: { tool_name, input, output, status,
// project_id, approval_id?, actor? }.
const write = async (entry) => {
  const row = {
    id: uuidv4(),
    tool_name: entry.tool_name,
    input: entry.input !== undefined ? entry.input : null,
    output: entry.output !== undefined ? entry.output : null,
    status: entry.status || 'ok',
    project_id: entry.project_id || null,
    approval_id: entry.approval_id || null,
    actor: entry.actor || null,
    created_at: new Date().toISOString(),
  };

  if (shouldTrySupabase()) {
    try {
      const { error } = await getSupabase().from(TABLE).insert(row);
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('write', error);
        } else {
          console.warn(`audit-log: insert skipped (${error.message})`);
        }
        return memoryWrite(row);
      }
      return row;
    } catch (err) {
      enterMemoryMode('write', err);
      return memoryWrite(row);
    }
  }
  return memoryWrite(row);
};

const list = async ({ projectId, limit = 50 } = {}) => {
  if (shouldTrySupabase()) {
    try {
      let query = getSupabase().from(TABLE).select('*');
      if (projectId) query = query.eq('project_id', projectId);
      query = query.order('created_at', { ascending: false }).limit(limit);
      const { data, error } = await query;
      if (error) {
        if (looksLikeMissingTable(error)) {
          enterMemoryMode('list', error);
        } else {
          console.warn(`audit-log: supabase list failed (${error.message}); using memory`);
        }
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
  write,
  list,
  setSupabase,
  _clearMemory,
};
