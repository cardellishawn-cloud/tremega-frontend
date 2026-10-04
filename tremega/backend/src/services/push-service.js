// src/services/push-service.js
// Expo push delivery: token registry + sender. Never throws.
//
// Tokens: adaptive — uses a `push_tokens` Supabase table when it exists,
// otherwise in-memory (lost on restart; the app re-registers on launch).
// Sending: Expo Push API over HTTPS (no Firebase/APNs credentials needed).
//
// Token shape: ExponentPushToken[...] (validated before storing/sending).

const TABLE = 'push_tokens';
const RETRY_AFTER_MS = 60 * 1000;
const EXPO_PUSH_URL = 'https://exp.host/--/api/v2/push/send';

let supabaseClient = null;
let supabaseLoadAttempted = false;
let memoryModeSince = null;

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

const shouldTrySupabase = () => {
  if (!getSupabase()) return false;
  if (memoryModeSince === null) return true;
  if (Date.now() - memoryModeSince > RETRY_AFTER_MS) {
    memoryModeSince = null;
    return true;
  }
  return false;
};

const looksLikeMissingTable = (error) =>
  /relation .* does not exist|could not find the table/i.test((error && error.message) || '');

// userId -> { token, platform, updated_at }
const memoryTokens = new Map();

const isExpoToken = (t) => typeof t === 'string' && /^ExponentPushToken\[[^\]]+\]$/.test(t);

const register = async ({ userId, token, platform }) => {
  if (!isExpoToken(token)) {
    return { ok: false, error: 'Invalid Expo push token format' };
  }
  const row = {
    user_id: userId,
    token,
    platform: platform || 'unknown',
    updated_at: new Date().toISOString(),
  };

  if (shouldTrySupabase()) {
    try {
      const { error } = await getSupabase()
        .from(TABLE)
        .upsert(row, { onConflict: 'token' });
      if (error) {
        if (looksLikeMissingTable(error)) {
          memoryModeSince = Date.now();
          memoryTokens.set(userId, row);
          return { ok: true, persisted: false };
        }
        console.warn(`push-service: supabase upsert failed (${error.message}); using memory`);
        memoryTokens.set(userId, row);
        return { ok: true, persisted: false };
      }
      return { ok: true, persisted: true };
    } catch (err) {
      memoryModeSince = Date.now();
      memoryTokens.set(userId, row);
      return { ok: true, persisted: false };
    }
  }
  memoryTokens.set(userId, row);
  return { ok: true, persisted: false };
};

const listTokens = async (userId) => {
  if (shouldTrySupabase()) {
    try {
      let query = getSupabase().from(TABLE).select('token, user_id, platform');
      if (userId) query = query.eq('user_id', userId);
      const { data, error } = await query;
      if (error) {
        if (looksLikeMissingTable(error)) memoryModeSince = Date.now();
      } else if (data) {
        return data.map((r) => r.token).filter(isExpoToken);
      }
    } catch (err) {
      memoryModeSince = Date.now();
    }
  }
  if (userId) {
    const row = memoryTokens.get(userId);
    return row && isExpoToken(row.token) ? [row.token] : [];
  }
  return [...memoryTokens.values()].map((r) => r.token).filter(isExpoToken);
};

// Fire-and-forget send. Returns { sent, results } — never throws.
const send = async ({ userId, title, body, data }) => {
  try {
    const tokens = await listTokens(userId || null);
    if (tokens.length === 0) return { sent: 0, reason: 'no-tokens' };

    const messages = tokens.map((to) => ({
      to, title, body, data: data || {}, sound: 'default',
    }));

    const res = await fetch(EXPO_PUSH_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });
    const json = await res.json().catch(() => ({}));
    const results = Array.isArray(json.data) ? json.data : [];
    const okCount = results.filter((r) => r.status === 'ok').length;
    const errors = results.filter((r) => r.status === 'error')
      .map((r) => r.message || r.details?.error).slice(0, 3);
    if (errors.length) console.warn('push-service: expo send errors:', errors.join(' | '));
    return { sent: okCount, attempted: tokens.length };
  } catch (err) {
    console.warn(`push-service: send failed (${err.message})`);
    return { sent: 0, reason: err.message };
  }
};

const _clearMemory = () => memoryTokens.clear();

module.exports = {
  register,
  send,
  listTokens,
  isExpoToken,
  _clearMemory,
};
