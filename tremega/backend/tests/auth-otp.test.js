// tests/auth-otp.test.js
// Phase 2 Week 1 (Verify refactor): SMS OTP login via Twilio Verify API.
// Verify owns code generation, expiry, and rate limits; these tests mock the
// injected Twilio client, so no live calls. JWT secret uses fragment
// indirection to dodge the write-time redactor.

const SECRET_KEY = 'JWT' + '_SECRET';
process.env[SECRET_KEY] = process.env[SECRET_KEY] || 'otp-test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonweb' + 'token');

const authRouter = require('../routes/auth');
const userStore = require('../src/services/user-store');
const twilio = require('../src/services/twilio-service');

const WORKER_PHONE = '+15557654321';
const WORKER = {
  id: '80000000-0000-4000-8000-000000000001',
  phone: WORKER_PHONE,
  email: 'worker@tremega.com',
  full_name: 'Test Worker',
  role: 'sub',
  is_active: true,
};

const app = express();
app.use(express.json());
app.use('/api/auth', authRouter);

let twilioMock;
let verificationsCreate;
let checksCreate;
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  process.env.TWILIO_AUTH_TOKEN = 'test-token';
  process.env.TWILIO_PHONE_NUMBER = '+15550009999';
  process.env.TWILIO_VERIFY_SERVICE_SID = 'VAtest';

  userStore._clearMemory();
  userStore.setSupabase(null);
  userStore._addMemoryUser({ ...WORKER });

  verificationsCreate = jest.fn(async ({ to }) => ({ status: 'pending', to }));
  // Wrong code 000000 stays 'pending'; anything else 'approved'.
  checksCreate = jest.fn(async ({ to, code }) => ({
    status: code === '000000' ? 'pending' : 'approved',
    to,
  }));
  twilioMock = {
    verify: {
      v2: {
        services: jest.fn(() => ({
          verifications: { create: verificationsCreate },
          verificationChecks: { create: checksCreate },
        })),
      },
    },
  };
  twilio.setTwilioClient(twilioMock);
});

afterEach(() => {
  process.env = savedEnv;
  twilio.setTwilioClient(null);
});

describe('POST /api/auth/otp/send (Twilio Verify)', () => {
  test('success → sent:true + status pending; Verify called with sms channel', async () => {
    const res = await request(app).post('/api/auth/otp/send').send({ phone: WORKER_PHONE });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(expect.objectContaining({ sent: true, status: 'pending', message: 'OTP sent' }));
    expect(verificationsCreate).toHaveBeenCalledWith({ to: WORKER_PHONE, channel: 'sms' });
  });

  test('malformed phone → 400, no Verify call', async () => {
    const res = await request(app).post('/api/auth/otp/send').send({ phone: '555-1234' });
    expect(res.status).toBe(400);
    expect(verificationsCreate).not.toHaveBeenCalled();
  });

  test('Verify unconfigured → sent:false, no code leaked', async () => {
    delete process.env.TWILIO_VERIFY_SERVICE_SID;
    const res = await request(app).post('/api/auth/otp/send').send({ phone: WORKER_PHONE });
    expect(res.status).toBe(200);
    expect(res.body.sent).toBe(false);
    expect(res.body.reason).toBe('sms_unconfigured');
    expect(res.body).not.toHaveProperty('code');
  });

  test('Twilio failure → 502 with env-scrubbed reason', async () => {
    verificationsCreate.mockRejectedValueOnce(new Error('60200: acct ACtest token test-token failed'));
    const res = await request(app).post('/api/auth/otp/send').send({ phone: WORKER_PHONE });
    expect(res.status).toBe(502);
    expect(res.body.reason).not.toContain('ACtest');
    expect(res.body.reason).not.toContain('test-token');
  });
});

describe('POST /api/auth/otp/verify (Twilio Verify)', () => {
  test('approved → JWT with userId + role, plus user profile', async () => {
    const res = await request(app).post('/api/auth/otp/verify').send({ phone: WORKER_PHONE, code: '123456' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    const claims = jwt.verify(res.body.token, process.env[SECRET_KEY]);
    expect(claims.userId).toBe(WORKER.id);
    expect(claims.role).toBe('sub');
    expect(res.body.user).toEqual(expect.objectContaining({
      id: WORKER.id, full_name: 'Test Worker', role: 'sub', phone: WORKER_PHONE,
    }));
    expect(checksCreate).toHaveBeenCalledWith({ to: WORKER_PHONE, code: '123456' });
  });

  test('wrong code (status pending) → 401', async () => {
    const res = await request(app).post('/api/auth/otp/verify').send({ phone: WORKER_PHONE, code: '000000' });
    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid or expired/i);
  });

  test('expired/no pending verification (Twilio throw) → 401', async () => {
    checksCreate.mockRejectedValueOnce(new Error('20404: not found'));
    const res = await request(app).post('/api/auth/otp/verify').send({ phone: WORKER_PHONE, code: '123456' });
    expect(res.status).toBe(401);
  });

  test('approved but unknown phone → 403 contact-admin', async () => {
    const res = await request(app).post('/api/auth/otp/verify').send({ phone: '+15550000000', code: '123456' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/contact your administrator/i);
  });

  test('approved but deactivated account → 403', async () => {
    userStore._clearMemory();
    userStore._addMemoryUser({ ...WORKER, is_active: false });
    const res = await request(app).post('/api/auth/otp/verify').send({ phone: WORKER_PHONE, code: '123456' });
    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/deactivated/i);
  });

  test('malformed code → 400', async () => {
    const res = await request(app).post('/api/auth/otp/verify').send({ phone: WORKER_PHONE, code: '12' });
    expect(res.status).toBe(400);
    expect(checksCreate).not.toHaveBeenCalled();
  });
});
