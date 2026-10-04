// src/services/user-store.js
// User lookup for OTP login: by phone (tolerant of the phone column's actual
// name, same candidate strategy as geofence-resolver) and by id. No self-
// signup — owner creates accounts, so a missing user is a hard 403, not a
// registration. Memory fallback for tests / pre-migration.

let supabaseClient = null;
let supabaseLoadAttempted = false;

const memoryUsers = new Map(); // id -> user

const setSupabase = (client) => {
  supabaseClient = client;
  supabaseLoadAttempted = true;
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

const PHONE_CANDIDATES = ['phone', 'phone_number', 'phone_e164', 'mobile', 'sms_number'];

const looksLikeUnavailable = (error) => Boolean(
  error
    && error.message
    && /does not exist|could not find|schema cache|42P01|relation|column|unregistered|401|invalid.*(api )?key/i.test(error.message),
);

const findByPhone = async (phone) => {
  // Memory users first (tests + shadow), then live table.
  for (const user of memoryUsers.values()) {
    if (PHONE_CANDIDATES.some((col) => user[col] === phone)) return user;
  }
  if (!getSupabase()) return null;
  for (const col of PHONE_CANDIDATES) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const { data, error } = await getSupabase().from('users').select('*').eq(col, phone).limit(1);
      if (error) {
        if (looksLikeUnavailable(error)) return null; // column missing → live lookup can't work
        // eslint-disable-next-line no-continue
        continue;
      }
      if (Array.isArray(data) && data.length > 0) return data[0];
    } catch (err) {
      return null;
    }
  }
  return null;
};

const findById = async (id) => {
  if (memoryUsers.has(id)) return memoryUsers.get(id);
  if (!getSupabase()) return null;
  try {
    const { data, error } = await getSupabase().from('users').select('*').eq('id', id).limit(1);
    if (error || !Array.isArray(data) || data.length === 0) return null;
    return data[0];
  } catch (err) {
    return null;
  }
};

// Test/seed helper: register an in-memory user.
const _addMemoryUser = (user) => memoryUsers.set(user.id, user);
const _clearMemory = () => memoryUsers.clear();

module.exports = { findByPhone, findById, setSupabase, _addMemoryUser, _clearMemory };
