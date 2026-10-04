// src/services/otp-store.js
// One-time passcodes for SMS login. Codes are stored sha256-hashed only,
// expire after 10 minutes, allow 5 verify attempts, and have a 60s resend
// cooldown. Supabase `otp_codes` table is attempted first; memory fallback
// keeps everything working pre-migration / on credential failure (same
// pattern as approval-store).

const crypto = require('crypto');

const OTP_TTL_MS = 10 * 60 * 1000;
const MAX_ATTEMPTS = 5;
const RESEND_COOLDOWN_MS = 60 * 1000;
const RETRY_AFTER_MS = 30 * 1000;

let supabaseClient = null;
let supabaseLoadAttempted = false;
let memoryModeSince = null;

const memoryOtps = new Map(); // phone -> record

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

const looksLikeUnavailable = (error) => Boolean(
  error
    && error.message
    && /does not exist|could not find|schema cache|42P01|relation|unregistered|401|invalid.*(api )?key/i.test(error.message),
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
  if (memoryModeSince === null) {
    console.warn(`otp-store: ${op} falling back to in-memory store (${error.message}). Will retry Supabase periodically.`);
  }
  memoryModeSince = Date.now();
};

const hashCode = (code) => crypto.createHash('sha256').update(String(code)).digest('hex');

const generateCode = () => String(crypto.randomInt(0, 1000000)).padStart(6, '0');

// Create + store a new OTP for the phone. Returns { code, expires_at } —
// the plaintext code is for the SMS sender ONLY, never for API responses.
const createOtp = async (phone) => {
  const code = generateCode();
  const record = {
    id: crypto.randomUUID(),
    phone,
    code_hash: hashCode(code),
    expires_at: new Date(Date.now() + OTP_TTL_MS).toISOString(),
    attempts: 0,
    created_at: new Date().toISOString(),
  };

  if (shouldTrySupabase()) {
    try {
      // One active OTP per phone: clear prior codes first.
      await getSupabase().from('otp_codes').delete().eq('phone', phone);
      const { error } = await getSupabase().from('otp_codes').insert(record);
      if (error) {
        if (looksLikeUnavailable(error)) {
          enterMemoryMode('create', error);
          memoryOtps.set(phone, record);
        } else {
          return { error: { code: 'OTP_STORE_ERROR', message: error.message } };
        }
      }
    } catch (err) {
      enterMemoryMode('create', err);
      memoryOtps.set(phone, record);
    }
  } else {
    memoryOtps.set(phone, record);
  }
  return { code, expires_at: record.expires_at };
};

const loadLatest = async (phone) => {
  if (shouldTrySupabase()) {
    try {
      const { data, error } = await getSupabase()
        .from('otp_codes')
        .select('*')
        .eq('phone', phone)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) {
        if (error.code === 'PGRST116') return memoryOtps.get(phone) || null; // no rows
        if (looksLikeUnavailable(error)) {
          enterMemoryMode('load', error);
          return memoryOtps.get(phone) || null;
        }
        return null;
      }
      return data || memoryOtps.get(phone) || null;
    } catch (err) {
      enterMemoryMode('load', err);
      return memoryOtps.get(phone) || null;
    }
  }
  return memoryOtps.get(phone) || null;
};

const bumpAttempts = async (record) => {
  record.attempts = (record.attempts || 0) + 1;
  if (shouldTrySupabase()) {
    try {
      await getSupabase().from('otp_codes').update({ attempts: record.attempts }).eq('id', record.id);
    } catch (err) { /* tolerate */ }
  }
  if (memoryOtps.get(record.phone)?.id === record.id) memoryOtps.set(record.phone, record);
};

const consume = async (record) => {
  if (shouldTrySupabase()) {
    try {
      await getSupabase().from('otp_codes').delete().eq('id', record.id);
    } catch (err) { /* tolerate */ }
  }
  if (memoryOtps.get(record.phone)?.id === record.id) memoryOtps.delete(record.phone);
};

// Verify a code. Returns { ok: true } or { ok: false, reason } where reason
// is one of: no_code | expired | too_many_attempts | mismatch.
const verifyOtp = async (phone, code) => {
  const record = await loadLatest(phone);
  if (!record) return { ok: false, reason: 'no_code' };
  if (Date.parse(record.expires_at) < Date.now()) return { ok: false, reason: 'expired' };
  if ((record.attempts || 0) >= MAX_ATTEMPTS) return { ok: false, reason: 'too_many_attempts' };
  if (record.code_hash !== hashCode(code)) {
    await bumpAttempts(record);
    return { ok: false, reason: 'mismatch' };
  }
  await consume(record);
  return { ok: true };
};

// Resend throttle: true when the latest code is older than the cooldown.
const resendAllowed = async (phone) => {
  const record = await loadLatest(phone);
  if (!record) return true;
  return Date.now() - Date.parse(record.created_at) >= RESEND_COOLDOWN_MS;
};

const _clearMemory = () => memoryOtps.clear();

module.exports = {
  createOtp,
  verifyOtp,
  resendAllowed,
  setSupabase,
  _clearMemory,
  OTP_TTL_MS,
  MAX_ATTEMPTS,
  RESEND_COOLDOWN_MS,
};
