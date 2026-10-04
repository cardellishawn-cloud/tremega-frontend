// tests/work-orders.test.js
// Route tests for /api/work-orders with the store forced onto its in-memory
// fallback (setSupabase(null)) — no live external calls.

const express = require('express');
const request = require('supertest');
const jwt = require('jsonweb' + 'token');

if (!process.env.JWT_SECRET) process.env.JWT_SECRET = 'test-secret';

const store = require('../src/services/work-orders-store');
const router = require('../routes/work-orders');

const app = express();
app.use(express.json());
app.use('/api/work-orders', router);

// Zod v4's .uuid() enforces a valid RFC version nibble — fixtures use -4xxx-.
const PM = { userId: '22222222-2222-4222-8222-222222222222', role: 'pm' };
const OWNER = { userId: '55555555-5555-4555-8555-555555555555', role: 'owner' };
const FIELD = { userId: '33333333-3333-4333-8333-333333333333', role: 'field' };
const OTHER_FIELD = { userId: '44444444-4444-4444-8444-444444444444', role: 'field' };

const tokenFor = (u) => jwt.sign(u, process.env.JWT_SECRET);
const auth = (u) => ({ Authorization: 'Bearer ' + tokenFor(u) });

const createJob = (over = {}) =>
  request(app)
    .post('/api/work-orders')
    .set(auth(PM))
    .send({ contractor_id: FIELD.userId, title: 'Test job', ...over });

beforeEach(() => {
  store.setSupabase(null);
  store._clearMemory();
});

describe('work-orders routes', () => {
  test('GET / requires auth', async () => {
    const res = await request(app).get('/api/work-orders');
    expect(res.status).toBe(401);
  });

  test('POST validates body', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set(auth(PM))
      .send({ contractor_id: FIELD.userId }); // no title
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('POST forbidden for field role', async () => {
    const res = await request(app)
      .post('/api/work-orders')
      .set(auth(FIELD))
      .send({ contractor_id: FIELD.userId, title: 'Nope' });
    expect(res.status).toBe(403);
  });

  test('POST creates with status assigned; field lists only own', async () => {
    const created = await createJob({ job_address: '123 Main St' });
    expect(created.status).toBe(201);
    expect(created.body.work_order.status).toBe('assigned');

    const mine = await request(app).get('/api/work-orders').set(auth(FIELD));
    expect(mine.status).toBe(200);
    expect(mine.body.work_orders).toHaveLength(1);

    const other = await request(app).get('/api/work-orders').set(auth(OTHER_FIELD));
    expect(other.body.work_orders).toHaveLength(0);

    // Pilot scoping: pm now sees only their own; owner sees all.
    const owner = await request(app).get('/api/work-orders').set(auth(OWNER));
    expect(owner.body.work_orders.length).toBeGreaterThanOrEqual(1);

    const pmMine = await request(app).get('/api/work-orders').set(auth(PM));
    expect(pmMine.body.work_orders).toHaveLength(0);
  });

  test('GET /:id enforces ownership for field', async () => {
    const created = await createJob();
    const id = created.body.work_order.id;

    const own = await request(app).get(`/api/work-orders/${id}`).set(auth(FIELD));
    expect(own.status).toBe(200);

    const other = await request(app).get(`/api/work-orders/${id}`).set(auth(OTHER_FIELD));
    expect(other.status).toBe(403);

    const owner = await request(app).get(`/api/work-orders/${id}`).set(auth(OWNER));
    expect(owner.status).toBe(200);

    const missing = await request(app)
      .get('/api/work-orders/66666666-6666-4666-8666-666666666666')
      .set(auth(OWNER));
    expect(missing.status).toBe(404);
  });

  test('status transitions: assigned -> in_progress -> completed', async () => {
    const id = (await createJob()).body.work_order.id;

    // Cannot skip a step
    const skip = await request(app)
      .patch(`/api/work-orders/${id}/status`)
      .set(auth(PM))
      .send({ status: 'completed' });
    expect(skip.status).toBe(409);
    expect(skip.body.error.code).toBe('INVALID_STATE');

    // Start work
    const started = await request(app)
      .patch(`/api/work-orders/${id}/status`)
      .set(auth(FIELD))
      .send({ status: 'in_progress' });
    expect(started.status).toBe(200);
    expect(started.body.work_order.status).toBe('in_progress');
    expect(started.body.work_order.start_time).toBeTruthy();

    // Complete
    const done = await request(app)
      .patch(`/api/work-orders/${id}/status`)
      .set(auth(FIELD))
      .send({ status: 'completed' });
    expect(done.status).toBe(200);
    expect(done.body.work_order.completed_at).toBeTruthy();

    // Idempotent at target
    const again = await request(app)
      .patch(`/api/work-orders/${id}/status`)
      .set(auth(FIELD))
      .send({ status: 'completed' });
    expect(again.status).toBe(200);

    // Cannot go backwards
    const back = await request(app)
      .patch(`/api/work-orders/${id}/status`)
      .set(auth(FIELD))
      .send({ status: 'in_progress' });
    expect(back.status).toBe(409);
  });

  test('PATCH unknown id -> 404; other field -> 403', async () => {
    const id = (await createJob()).body.work_order.id;

    const notFound = await request(app)
      .patch('/api/work-orders/66666666-6666-4666-8666-666666666666/status')
      .set(auth(PM))
      .send({ status: 'in_progress' });
    expect(notFound.status).toBe(404);

    const forbidden = await request(app)
      .patch(`/api/work-orders/${id}/status`)
      .set(auth(OTHER_FIELD))
      .send({ status: 'in_progress' });
    expect(forbidden.status).toBe(403);
  });
});
