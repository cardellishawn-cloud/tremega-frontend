// tests/checkins.test.js
// Week 4: /api/checkins routes + the four newly-wired agent tool executors.
// Everything external is mocked: Supabase (table-behavior mock), Twilio
// (injected client). JWTs are signed with a test secret.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const checkinsRouter = require('../routes/checkins');
const checkinsStore = require('../src/services/checkins-store');
const activityStore = require('../src/services/activity-store');
const geofenceResolver = require('../src/services/geofence-resolver');
const twilio = require('../src/services/twilio-service');
const registry = require('../src/tools/registry');

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const OWNER = { userId: 'u-owner', role: 'admin' }; // legacy admin -> owner
const PM = { userId: 'u-pm', role: 'contractor' }; // legacy contractor -> pm
const FIELD = { userId: 'u-field', role: 'sub' }; // legacy sub -> field

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const auth = (payload) => ({ Authorization: `Bearer ${sign(payload)}` });

// Site fence used across tests: center (40.0, -74.0), radius 500m.
const FENCE_PHASE = {
  id: 'phase-1',
  project_id: PROJECT_ID,
  name: 'rough-in',
  site_lat: 40.0,
  site_lng: -74.0,
  site_radius_m: 500,
};
const INSIDE_POINT = { lat: 40.001, lng: -74.001 }; // ~139m from center
const OUTSIDE_POINT = { lat: 40.05, lng: -74.05 }; // ~6.8km from center
const WORKER_PHONE = '+15557654321';
const PM_PHONE = '+15550001111';
const OTHER_WORKER = '123e4567-e89b-12d3-a456-426614174999';

// ---------- Table-behavior Supabase mock ----------

const makeTableSupabase = (tables = {}) => {
  const inserted = [];
  const from = (table) => {
    const state = { filters: [], patch: null, lim: null };
    const filtered = () => {
      let rs = (tables[table] || []).slice();
      state.filters.forEach(({ col, val }) => {
        rs = rs.filter((r) => r[col] === val);
      });
      return rs;
    };
    const chain = {
      select: () => chain,
      eq: (col, val) => {
        state.filters.push({ col, val });
        return chain;
      },
      order: () => chain,
      limit: (n) => {
        state.lim = n;
        return chain;
      },
      insert: async (row) => {
        inserted.push({ table, row });
        // eslint-disable-next-line no-param-reassign
        tables[table] = tables[table] || [];
        tables[table].push(row);
        return { data: [row], error: null };
      },
      update: (patch) => {
        state.patch = patch;
        return chain;
      },
      single: async () => {
        const rs = filtered();
        if (state.patch) rs.forEach((r) => Object.assign(r, state.patch));
        return rs[0]
          ? { data: rs[0], error: null }
          : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
      },
      then: (resolve, reject) =>
        (async () => {
          let rs = filtered();
          if (state.lim) rs = rs.slice(0, state.lim);
          return { data: rs, error: null };
        })().then(resolve, reject),
    };
    return chain;
  };
  return { inserted, tables, from };
};

const makeTwilioMock = () => ({
  messages: {
    create: jest.fn(async ({ to }) => ({ sid: 'SM_route_test', status: 'queued', to })),
  },
  calls: { create: jest.fn() },
});

// ---------- App ----------

const app = express();
app.use(express.json());
app.use('/api/checkins', checkinsRouter);

let supabaseMock;
let twilioMock;
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.PM_ALERT_PHONE;

  checkinsStore._clearMemory();
  activityStore._clearMemory();

  supabaseMock = makeTableSupabase({
    phases: [FENCE_PHASE],
    bids: [],
    projects: [],
    users: [{ id: FIELD.userId, phone: WORKER_PHONE }],
    checkins: [],
    activity_log: [],
  });
  checkinsStore.setSupabase(supabaseMock);
  geofenceResolver.setSupabase(supabaseMock);
  activityStore.setSupabase(supabaseMock);

  twilioMock = makeTwilioMock();
  twilio.setTwilioClient(twilioMock);
});

afterEach(() => {
  process.env = savedEnv;
  twilio.setTwilioClient(null);
});

// ---------- POST /api/checkins ----------

describe('POST /api/checkins validation + auth', () => {
  test('400 on invalid body (bad project_id, missing lat)', async () => {
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: 'not-a-uuid', lng: -74 });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.issues)).toBe(true);
  });

  test('400 when accuracy_m is out of range', async () => {
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, lat: 40, lng: -74, accuracy_m: 5000 });
    expect(res.status).toBe(400);
  });

  test('401 without a token', async () => {
    const res = await request(app)
      .post('/api/checkins')
      .send({ project_id: PROJECT_ID, lat: 40, lng: -74 });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/checkins verification flow', () => {
  test('inside geofence -> 201 verified=true, persisted, SMS confirmation sent to worker', async () => {
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, ...INSIDE_POINT, accuracy_m: 10, note: 'on site' });

    expect(res.status).toBe(201);
    expect(res.body.verification.verified).toBe(true);
    expect(res.body.verification.distance_m).toBeGreaterThan(100);
    expect(res.body.verification.confidence).toBe('high');
    expect(res.body.checkin.verified).toBe(true);
    expect(res.body.checkin.verification_status).toBe('verified');
    expect(res.body.checkin.flagged).toBe(false);
    expect(res.body.checkin.worker_id).toBe(FIELD.userId);
    expect(res.body.checkin.id).toBeDefined();

    // Persisted via the store (mock supabase captured the insert).
    const checkinInserts = supabaseMock.inserted.filter((i) => i.table === 'checkins');
    expect(checkinInserts).toHaveLength(1);

    // SMS confirmation attempted to the worker's phone from the users table.
    expect(res.body.sms.sent).toBe(true);
    expect(twilioMock.messages.create).toHaveBeenCalledTimes(1);
    expect(twilioMock.messages.create.mock.calls[0][0].to).toBe(WORKER_PHONE);
  });

  test('outside geofence -> verified=false, flagged, PM alert SMS attempted', async () => {
    process.env.PM_ALERT_PHONE = PM_PHONE;
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, ...OUTSIDE_POINT, accuracy_m: 10 });

    expect(res.status).toBe(201);
    expect(res.body.verification.verified).toBe(false);
    expect(res.body.checkin.verified).toBe(false);
    expect(res.body.checkin.verification_status).toBe('outside_geofence');
    expect(res.body.checkin.flagged).toBe(true);

    expect(res.body.sms.sent).toBe(true);
    expect(twilioMock.messages.create).toHaveBeenCalledTimes(1);
    const smsCall = twilioMock.messages.create.mock.calls[0][0];
    expect(smsCall.to).toBe(PM_PHONE);
    expect(smsCall.body).toMatch(/OUTSIDE the geofence/);
  });

  test('no geofence configured -> verified=null, unverified_no_geofence, no SMS', async () => {
    geofenceResolver.setSupabase(makeTableSupabase({ phases: [], bids: [], projects: [] }));
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, ...INSIDE_POINT, accuracy_m: 10 });

    expect(res.status).toBe(201);
    expect(res.body.verification.verified).toBeNull();
    expect(res.body.checkin.verified).toBeNull();
    expect(res.body.checkin.verification_status).toBe('unverified_no_geofence');
    expect(res.body.checkin.flagged).toBe(false);
    expect(res.body.sms.sent).toBe(false);
    expect(twilioMock.messages.create).not.toHaveBeenCalled();

    // Still persisted — unverified is not an error.
    const checkinInserts = supabaseMock.inserted.filter((i) => i.table === 'checkins');
    expect(checkinInserts).toHaveLength(1);
  });

  test('twilio failure -> still 201 with sms.sent=false', async () => {
    twilioMock.messages.create.mockImplementation(async () => {
      throw new Error('provider exploded');
    });
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, ...INSIDE_POINT, accuracy_m: 10 });

    expect(res.status).toBe(201);
    expect(res.body.verification.verified).toBe(true);
    expect(res.body.sms.sent).toBe(false);
    expect(res.body.sms.error).toBeDefined();
  });

  test('worker without a known phone -> 201, sms.sent=false (worker_phone_unknown)', async () => {
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(OWNER)) // users table only has FIELD's phone
      .send({ project_id: PROJECT_ID, ...INSIDE_POINT, accuracy_m: 10 });

    expect(res.status).toBe(201);
    expect(res.body.sms.sent).toBe(false);
    expect(res.body.sms.error).toBe('worker_phone_unknown');
    expect(twilioMock.messages.create).not.toHaveBeenCalled();
  });
});

// ---------- GET /api/checkins ----------

describe('GET /api/checkins RBAC scoping', () => {
  const seed = () => {
    // eslint-disable-next-line no-param-reassign
    supabaseMock.tables.checkins = [
      { id: 'c-own', worker_id: FIELD.userId, project_id: PROJECT_ID, created_at: '2026-09-18T10:00:00Z' },
      { id: 'c-other', worker_id: OTHER_WORKER, project_id: PROJECT_ID, created_at: '2026-09-18T11:00:00Z' },
    ];
  };

  test('field worker sees only their own check-ins', async () => {
    seed();
    const res = await request(app)
      .get('/api/checkins')
      .query({ project_id: PROJECT_ID })
      .set(auth(FIELD));
    expect(res.status).toBe(200);
    expect(res.body.checkins).toHaveLength(1);
    expect(res.body.checkins[0].worker_id).toBe(FIELD.userId);
  });

  test('field worker cannot widen scope via worker_id query param', async () => {
    seed();
    const res = await request(app)
      .get('/api/checkins')
      .query({ worker_id: OTHER_WORKER })
      .set(auth(FIELD));
    expect(res.status).toBe(200);
    expect(res.body.checkins.every((c) => c.worker_id === FIELD.userId)).toBe(true);
  });

  test('pm sees all check-ins', async () => {
    seed();
    const res = await request(app).get('/api/checkins').set(auth(PM));
    expect(res.status).toBe(200);
    expect(res.body.checkins).toHaveLength(2);
  });

  test('owner can filter by worker_id', async () => {
    seed();
    const res = await request(app)
      .get('/api/checkins')
      .query({ worker_id: OTHER_WORKER })
      .set(auth(OWNER));
    expect(res.status).toBe(200);
    expect(res.body.checkins).toHaveLength(1);
    expect(res.body.checkins[0].id).toBe('c-other');
  });

  test('400 on invalid query (bad uuid)', async () => {
    const res = await request(app)
      .get('/api/checkins')
      .query({ project_id: 'nope' })
      .set(auth(PM));
    expect(res.status).toBe(400);
  });

  test('401 without a token', async () => {
    const res = await request(app).get('/api/checkins');
    expect(res.status).toBe(401);
  });
});

// ---------- Agent tool wiring ----------

describe('agent tool executors wired to real services', () => {
  beforeEach(() => {
    registry.setSupabase(supabaseMock); // propagates to all stores + resolver
  });

  test('geofence_check returns a real verification result', async () => {
    const result = await registry.getTool('geofence_check').execute({
      project_id: PROJECT_ID,
      latitude: INSIDE_POINT.lat,
      longitude: INSIDE_POINT.lng,
    });
    expect(result.error).toBeUndefined();
    expect(result.within_geofence).toBe(true);
    expect(result.distance_meters).toBeGreaterThan(100);
    expect(result.geofence_source).toBe('phases');
  });

  test('geofence_check with no geofence -> unverified_no_geofence (not an error)', async () => {
    registry.setSupabase(makeTableSupabase({ phases: [], bids: [], projects: [] }));
    const result = await registry.getTool('geofence_check').execute({
      project_id: PROJECT_ID,
      latitude: INSIDE_POINT.lat,
      longitude: INSIDE_POINT.lng,
    });
    expect(result.error).toBeUndefined();
    expect(result.within_geofence).toBeNull();
    expect(result.verification_status).toBe('unverified_no_geofence');
  });

  test('verify_checkin re-checks a stored row against the geofence', async () => {
    // eslint-disable-next-line no-param-reassign
    supabaseMock.tables.checkins = [
      {
        id: 'c-verify',
        worker_id: FIELD.userId,
        project_id: PROJECT_ID,
        lat: INSIDE_POINT.lat,
        lng: INSIDE_POINT.lng,
        accuracy_m: 10,
        verified: false,
        created_at: '2026-09-18T10:00:00Z',
      },
    ];
    const result = await registry.getTool('verify_checkin').execute({ checkin_id: 'c-verify' });
    expect(result.error).toBeUndefined();
    expect(result.verified).toBe(true);
    expect(result.previous_verified).toBe(false);
    expect(result.distance_m).toBeGreaterThan(100);
  });

  test('verify_checkin on a missing id -> CHECKIN_NOT_FOUND tool error', async () => {
    const result = await registry.getTool('verify_checkin').execute({ checkin_id: 'nope' });
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('CHECKIN_NOT_FOUND');
  });

  test('log_activity inserts into activity_log and reports persisted', async () => {
    const result = await registry.getTool('log_activity').execute({
      project_id: PROJECT_ID,
      activity: 'Pulled 12/2 NM-B to kitchen rough-in',
      hours: 3.5,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe('logged');
    expect(result.persisted).toBe(true);
    expect(result.activity_id).toBeDefined();
    const activityInserts = supabaseMock.inserted.filter((i) => i.table === 'activity_log');
    expect(activityInserts).toHaveLength(1);
    expect(activityInserts[0].row.activity).toMatch(/12\/2 NM-B/);
  });

  test('notify_via_twilio sends a real SMS through the injected client', async () => {
    const result = await registry.getTool('notify_via_twilio').execute({
      to_phone: '+15557654321',
      message: 'Gate code 4321',
      project_id: PROJECT_ID,
    });
    expect(result.error).toBeUndefined();
    expect(result.message_sid).toBe('SM_route_test');
    expect(twilioMock.messages.create).toHaveBeenCalledTimes(1);
  });

  test('notify_via_twilio surfaces a structured error when Twilio fails', async () => {
    twilioMock.messages.create.mockImplementation(async () => {
      throw new Error('carrier down');
    });
    const result = await registry.getTool('notify_via_twilio').execute({
      to_phone: '+15557654321',
      message: 'hello',
    });
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('TWILIO_ERROR');
  });
});
