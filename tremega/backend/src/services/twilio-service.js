// src/services/twilio-service.js
// Twilio SMS/voice sender. The client is created lazily from env at call time
// (never at require time) so tests can inject a mock via setTwilioClient and
// `npm test` makes no live calls. All errors are normalized to structured
// { code, message } Error objects; env values are scrubbed from messages.

let injectedClient = null; // set via setTwilioClient (tests)
let lazyClient = null; // built once from env on first use

const ENV_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];

const isConfigured = () => ENV_KEYS.every((k) => Boolean(process.env[k]));

// Test hook: inject a mock client (or null to restore lazy env-based creation).
const setTwilioClient = (client) => {
  injectedClient = client;
};

const getClient = () => {
  if (injectedClient) return injectedClient;
  if (!isConfigured()) return null;
  if (!lazyClient) {
    // eslint-disable-next-line global-require
    const twilio = require('twilio');
    lazyClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
  }
  return lazyClient;
};

// ---------- Structured errors ----------

const structuredError = (code, message) => {
  const err = new Error(message);
  err.code = code;
  return err;
};

// Remove any env value that might appear inside a provider error message.
const scrubEnv = (message) => {
  let out = String(message || 'Unknown Twilio error');
  ENV_KEYS.forEach((k) => {
    const v = process.env[k];
    if (v && v.length >= 6) out = out.split(v).join('[redacted]');
  });
  // Also scrub anything that looks like a Twilio SID / auth token fragment.
  out = out.replace(/AC[a-f0-9]{32}/gi, '[redacted-sid]');
  return out.slice(0, 300);
};

const normalizeTwilioError = (err) =>
  structuredError('TWILIO_ERROR', scrubEnv(err && err.message));

// ---------- Validation ----------

const E164_RE = /^\+[1-9]\d{7,14}$/;

// Validate + normalize an E.164 phone number. Accepts a missing leading '+'
// and common formatting characters; returns the canonical "+..." form.
// Throws structured { code: 'INVALID_PHONE' } on anything else.
const assertE164 = (phone) => {
  if (typeof phone !== 'string') {
    throw structuredError('INVALID_PHONE', 'Phone number must be a string');
  }
  const cleaned = phone.trim().replace(/[\s()-]/g, '');
  const withPlus = cleaned.startsWith('+') ? cleaned : `+${cleaned}`;
  if (!E164_RE.test(withPlus)) {
    throw structuredError('INVALID_PHONE', `Not a valid E.164 phone number: ${phone.slice(0, 20)}`);
  }
  return withPlus;
};

const assertBody = (body) => {
  if (typeof body !== 'string' || body.trim().length === 0) {
    throw structuredError('INVALID_BODY', 'Message body must be a non-empty string');
  }
  if (body.length > 1600) {
    throw structuredError('INVALID_BODY', 'Message body exceeds 1600 characters');
  }
  return body;
};

const requireClient = () => {
  const client = getClient();
  if (!client) {
    throw structuredError(
      'TWILIO_NOT_CONFIGURED',
      'Twilio is not configured (TWILIO_ACCOUNT_SID / TWILIO_AUTH_TOKEN / TWILIO_PHONE_NUMBER)',
    );
  }
  return client;
};

// ---------- Public API ----------

// Send an SMS. Resolves { sid, status, to }. Throws structured errors:
// INVALID_PHONE / INVALID_BODY / TWILIO_NOT_CONFIGURED / TWILIO_ERROR.
const sendSms = async (to, body) => {
  const toE164 = assertE164(to);
  const text = assertBody(body);
  const client = requireClient();
  try {
    const msg = await client.messages.create({
      to: toE164,
      from: process.env.TWILIO_PHONE_NUMBER,
      body: text,
    });
    return { sid: msg.sid, status: msg.status, to: toE164 };
  } catch (err) {
    throw normalizeTwilioError(err);
  }
};

// Place a voice call. Pass { message } to speak text via TwiML, or
// { twimlUrl } to use hosted TwiML. Same result/error shape as sendSms.
const makeCall = async (to, options = {}) => {
  const toE164 = assertE164(to);
  const client = requireClient();

  const payload = { to: toE164, from: process.env.TWILIO_PHONE_NUMBER };
  if (options.twimlUrl) {
    payload.url = options.twimlUrl;
  } else if (options.message) {
    assertBody(options.message);
    // eslint-disable-next-line global-require
    const VoiceResponse = require('twilio').twiml.VoiceResponse;
    const twiml = new VoiceResponse();
    twiml.say(options.message);
    payload.twiml = twiml.toString();
  } else {
    throw structuredError('INVALID_BODY', 'makeCall requires { message } or { twimlUrl }');
  }

  try {
    const call = await client.calls.create(payload);
    return { sid: call.sid, status: call.status, to: toE164 };
  } catch (err) {
    throw normalizeTwilioError(err);
  }
};

// Fan out an SMS to many recipients with per-recipient isolation.
// Resolves { sent: [{ to, sid, status }], failed: [{ to, error }] } — never throws.
const notifyCrew = async (recipients, body) => {
  const sent = [];
  const failed = [];
  const list = Array.isArray(recipients) ? recipients : [];
  for (const to of list) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const res = await sendSms(to, body);
      sent.push(res);
    } catch (err) {
      failed.push({
        to,
        error: { code: err.code || 'TWILIO_ERROR', message: scrubEnv(err.message) },
      });
    }
  }
  return { sent, failed };
};

// ---------- Twilio Verify API (OTP) ----------
// Verify handles code generation, expiry (10 min), rate limits, and carrier
// routing (no A2P 10DLC registration). Errors arrive as structured TWILIO_ERRORs.

const verifyServiceSid = () => process.env.TWILIO_VERIFY_SERVICE_SID || null;

const isVerifyConfigured = () => Boolean(isConfigured() && verifyServiceSid());

// Start a verification: SMS a 6-digit code to `phone` (E.164).
// Returns { status, to } ('pending' on success) or throws structured TWILIO_ERROR.
const sendVerification = async (phone) => {
  assertE164(phone);
  if (!isVerifyConfigured()) {
    const err = new Error('Twilio Verify not configured');
    err.code = 'TWILIO_UNCONFIGURED';
    throw err;
  }
  try {
    const verification = await getClient()
      .verify.v2.services(verifyServiceSid())
      .verifications.create({ to: phone, channel: 'sms' });
    return { status: verification.status, to: verification.to };
  } catch (err) {
    throw normalizeTwilioError(err, { to: phone, op: 'verify_send' });
  }
};

// Check a user-entered code. Returns { status, to } — 'approved' = correct.
// Throws structured TWILIO_ERROR on API failure (e.g. 20404 expired/none pending).
const checkVerification = async (phone, code) => {
  assertE164(phone);
  if (!isVerifyConfigured()) {
    const err = new Error('Twilio Verify not configured');
    err.code = 'TWILIO_UNCONFIGURED';
    throw err;
  }
  try {
    const check = await getClient()
      .verify.v2.services(verifyServiceSid())
      .verificationChecks.create({ to: phone, code: String(code) });
    return { status: check.status, to: check.to };
  } catch (err) {
    throw normalizeTwilioError(err, { to: phone, op: 'verify_check' });
  }
};

module.exports = {
  isConfigured,
  setTwilioClient,
  assertE164,
  sendSms,
  makeCall,
  notifyCrew,
  verifyServiceSid,
  isVerifyConfigured,
  sendVerification,
  checkVerification,
};
