// tests/twilio-service.test.js
// Twilio service with a fully mocked client — no live calls, no network.

const twilio = require('../src/services/twilio-service');

const ENV_KEYS = ['TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_PHONE_NUMBER'];
let savedEnv;

const makeMockClient = (overrides = {}) => ({
  messages: {
    create: jest.fn(async ({ to }) => ({ sid: 'SM_test_123', status: 'queued', to })),
    ...(overrides.messages || {}),
  },
  calls: {
    create: jest.fn(async ({ to }) => ({ sid: 'CA_test_123', status: 'queued', to })),
    ...(overrides.calls || {}),
  },
});

beforeEach(() => {
  savedEnv = { ...process.env };
  process.env.TWILIO_ACCOUNT_SID = 'ACtestsecretvalue00000000000000001';
  process.env.TWILIO_AUTH_TOKEN = 'auth-token-secret-value';
  process.env.TWILIO_PHONE_NUMBER = '+15550009999';
});

afterEach(() => {
  process.env = savedEnv;
  twilio.setTwilioClient(null);
});

describe('assertE164', () => {
  test('accepts and normalizes valid numbers', () => {
    expect(twilio.assertE164('+15551234567')).toBe('+15551234567');
    expect(twilio.assertE164('15551234567')).toBe('+15551234567');
    expect(twilio.assertE164('(555) 123-4567')).toBe('+5551234567');
  });

  test('rejects invalid numbers with a structured error', () => {
    ['', '123', 'abc', '+0123456789', null, undefined, 42].forEach((bad) => {
      let err;
      try {
        twilio.assertE164(bad);
      } catch (e) {
        err = e;
      }
      expect(err).toBeDefined();
      expect(err.code).toBe('INVALID_PHONE');
    });
  });
});

describe('sendSms', () => {
  test('success returns { sid, status, to } and calls the client', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    const res = await twilio.sendSms('15557654321', 'hello crew');
    expect(res).toEqual({ sid: 'SM_test_123', status: 'queued', to: '+15557654321' });
    expect(client.messages.create).toHaveBeenCalledTimes(1);
    expect(client.messages.create).toHaveBeenCalledWith({
      to: '+15557654321',
      from: '+15550009999',
      body: 'hello crew',
    });
  });

  test('invalid phone throws INVALID_PHONE before any client call', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    await expect(twilio.sendSms('not-a-phone', 'hi')).rejects.toMatchObject({
      code: 'INVALID_PHONE',
    });
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  test('empty body throws INVALID_BODY before any client call', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    await expect(twilio.sendSms('+15557654321', '   ')).rejects.toMatchObject({
      code: 'INVALID_BODY',
    });
    expect(client.messages.create).not.toHaveBeenCalled();
  });

  test('not configured (no env, no injected client) -> TWILIO_NOT_CONFIGURED', async () => {
    ENV_KEYS.forEach((k) => delete process.env[k]);
    twilio.setTwilioClient(null);
    await expect(twilio.sendSms('+15557654321', 'hi')).rejects.toMatchObject({
      code: 'TWILIO_NOT_CONFIGURED',
    });
    expect(twilio.isConfigured()).toBe(false);
  });

  test('provider errors normalize to TWILIO_ERROR and scrub env values', async () => {
    const client = makeMockClient({
      messages: {
        create: jest.fn(async () => {
          throw new Error(`Authenticate: bad sid ${process.env.TWILIO_ACCOUNT_SID} / token ${process.env.TWILIO_AUTH_TOKEN}`);
        }),
      },
    });
    twilio.setTwilioClient(client);
    let err;
    try {
      await twilio.sendSms('+15557654321', 'hi');
    } catch (e) {
      err = e;
    }
    expect(err).toBeDefined();
    expect(err.code).toBe('TWILIO_ERROR');
    expect(err.message).not.toContain(process.env.TWILIO_ACCOUNT_SID);
    expect(err.message).not.toContain(process.env.TWILIO_AUTH_TOKEN);
    expect(err.message).toContain('[redacted]');
  });
});

describe('makeCall', () => {
  test('builds TwiML containing the message', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    const res = await twilio.makeCall('+15557654321', { message: 'Job site gate code is 4321' });
    expect(res.sid).toBe('CA_test_123');
    expect(client.calls.create).toHaveBeenCalledTimes(1);
    const payload = client.calls.create.mock.calls[0][0];
    expect(payload.to).toBe('+15557654321');
    expect(payload.twiml).toContain('<Say>');
    expect(payload.twiml).toContain('Job site gate code is 4321');
    expect(payload.twiml).toContain('</Response>');
  });

  test('uses twimlUrl when provided', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    await twilio.makeCall('+15557654321', { twimlUrl: 'https://example.com/twiml.xml' });
    const payload = client.calls.create.mock.calls[0][0];
    expect(payload.url).toBe('https://example.com/twiml.xml');
    expect(payload.twiml).toBeUndefined();
  });

  test('requires message or twimlUrl', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    await expect(twilio.makeCall('+15557654321', {})).rejects.toMatchObject({
      code: 'INVALID_BODY',
    });
    expect(client.calls.create).not.toHaveBeenCalled();
  });
});

describe('notifyCrew', () => {
  test('partial failure splits sent/failed and never throws', async () => {
    const client = makeMockClient({
      messages: {
        create: jest.fn(async ({ to }) => {
          if (to === '+15550000002') throw new Error('carrier rejected');
          return { sid: `SM_${to.slice(-4)}`, status: 'queued', to };
        }),
      },
    });
    twilio.setTwilioClient(client);
    const res = await twilio.notifyCrew(
      ['+15550000001', '+15550000002', '+15550000003'],
      'shift starts 7am',
    );
    expect(res.sent).toHaveLength(2);
    expect(res.sent.map((s) => s.to)).toEqual(['+15550000001', '+15550000003']);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].to).toBe('+15550000002');
    expect(res.failed[0].error.code).toBe('TWILIO_ERROR');
  });

  test('invalid recipients land in failed, not thrown', async () => {
    const client = makeMockClient();
    twilio.setTwilioClient(client);
    const res = await twilio.notifyCrew(['garbage', '+15550000001'], 'hi');
    expect(res.sent).toHaveLength(1);
    expect(res.failed).toHaveLength(1);
    expect(res.failed[0].error.code).toBe('INVALID_PHONE');
  });

  test('empty recipient list resolves cleanly', async () => {
    twilio.setTwilioClient(makeMockClient());
    await expect(twilio.notifyCrew([], 'hi')).resolves.toEqual({ sent: [], failed: [] });
  });
});
