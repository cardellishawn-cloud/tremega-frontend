// tests/integration/orders.test.js
// Ordering layer: routes + approval integration. "Integration" = full HTTP →
// service → store path, but with Supabase forced to the in-memory fallback
// (the live key is currently rejected, and npm test never makes live calls).

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const materialsRouter = require('../../routes/materials');
const ordersRouter = require('../../routes/orders');
const ordersService = require('../../src/services/orders-service');
const approvalStore = require('../../src/services/approval-store');
const materialsService = require('../../src/services/materials-service');
const registry = require('../../src/tools/registry');

const ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174001';
const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const GFCI = '50000000-0000-4000-8000-000000000013'; // $18.00
const PANEL = '50000000-0000-4000-8000-000000000009'; // $145.00
const BREAKER = '50000000-0000-4000-8000-000000000005'; // $8.50
const BOGUS = '99999999-9999-4999-9999-999999999999'; // valid v4 format, not in catalog

const OWNER = { userId: 'u-owner', role: 'admin' };
const PM = { userId: 'u-pm', role: 'contractor' };
const FIELD = { userId: 'u-field', role: 'sub' };

const sign = (p) => jwt.sign(p, process.env.JWT_SECRET);
const auth = (p) => ({ Authorization: `Bearer ${sign(p)}` });

const app = express();
app.use(express.json());
app.use('/api/materials', materialsRouter);
app.use('/api/orders', ordersRouter);

beforeEach(() => {
  ordersService._clearMemory();
  approvalStore._clearMemory();
  ordersService.setSupabase(null);
  approvalStore.setSupabase(null);
  materialsService.setSupabase(null);
  registry.setSupabase(null);
});

const createOrder = (as = PM) => request(app)
  .post('/api/orders')
  .set(auth(as))
  .send({ account_id: ACCOUNT_ID, materials: [{ material_id: GFCI, qty: 2 }, { material_id: BREAKER, qty: 4 }] });

describe('POST /api/materials/suggest', () => {
  test('owner gets a suggestion with no db write', async () => {
    const res = await request(app)
      .post('/api/materials/suggest')
      .set(auth(OWNER))
      .send({ account_id: ACCOUNT_ID, job_spec: 'new electrical panel', job_type: 'electrical' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('suggestion');
    expect(res.body.materials.length).toBeGreaterThan(0);
    expect(res.body.total_cost).toBeGreaterThan(0);
    expect(res.body.category_breakdown.electrical).toBeDefined();
  });

  test('400 when job_spec missing', async () => {
    const res = await request(app).post('/api/materials/suggest').set(auth(OWNER)).send({});
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('401 without token', async () => {
    const res = await request(app).post('/api/materials/suggest').send({ job_spec: 'panel' });
    expect(res.status).toBe(401);
  });

  test('403 for field role', async () => {
    const res = await request(app)
      .post('/api/materials/suggest')
      .set(auth(FIELD))
      .send({ job_spec: 'panel' });
    expect(res.status).toBe(403);
  });
});

describe('POST /api/orders (create)', () => {
  test('pm creates draft order with pending approval', async () => {
    const res = await createOrder(PM);
    expect(res.status).toBe(201);
    expect(res.body.status).toBe('draft');
    expect(res.body.approval_pending).toBe(true);
    expect(res.body.approval_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(res.body.total_cost).toBe(2 * 18.00 + 4 * 8.50); // 70.00
    const approval = await approvalStore.get(res.body.approval_id);
    expect(approval.status).toBe('pending');
    expect(approval.input.order_id).toBe(res.body.order_id);
  });

  test('owner can also create', async () => {
    const res = await createOrder(OWNER);
    expect(res.status).toBe(201);
  });

  test('400 on unknown material_id', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(PM))
      .send({ account_id: ACCOUNT_ID, materials: [{ material_id: BOGUS, qty: 1 }] });
    expect(res.status).toBe(400);
    expect(res.body.error.message).toContain(BOGUS);
  });

  test('400 on negative qty (zod)', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(PM))
      .send({ account_id: ACCOUNT_ID, materials: [{ material_id: GFCI, qty: -1 }] });
    expect(res.status).toBe(400);
  });

  test('403 for field role', async () => {
    const res = await createOrder(FIELD);
    expect(res.status).toBe(403);
  });

  test('401 without token', async () => {
    const res = await request(app).post('/api/orders').send({ account_id: ACCOUNT_ID, materials: [] });
    expect(res.status).toBe(401);
  });

  test('prices come from the server catalog, never the client', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set(auth(PM))
      .send({
        account_id: ACCOUNT_ID,
        materials: [{ material_id: PANEL, qty: 1, unit_cost: 0.01 }], // attempted tamper
      });
    expect(res.status).toBe(201);
    expect(res.body.total_cost).toBe(145.00);
  });
});

describe('POST /api/orders/:id/approve', () => {
  test('owner approves: order submitted, approval marked approved', async () => {
    const created = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('submitted');
    expect(res.body.message).toMatch(/Home Depot \(Phase 2\)/);
    expect(res.body.items_count).toBe(2);
    expect(res.body.total_cost).toBe(70.00);
    const approval = await approvalStore.get(created.body.approval_id);
    expect(approval.status).toBe('approved');
    expect(approval.decided_by).toBe(OWNER.userId);
  });

  test('pm cannot approve (403)', async () => {
    const created = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(PM))
      .send({});
    expect(res.status).toBe(403);
  });

  test('field cannot approve (403)', async () => {
    const created = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(FIELD))
      .send({});
    expect(res.status).toBe(403);
  });

  test('404 for non-existent order', async () => {
    const res = await request(app)
      .post(`/api/orders/${PROJECT_ID}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe('ORDER_NOT_FOUND');
  });

  test('409 on double-approve', async () => {
    const created = await createOrder();
    await request(app).post(`/api/orders/${created.body.order_id}/approve`).set(auth(OWNER)).send({});
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('INVALID_STATE');
  });

  test('approve writes an order_approved audit event', async () => {
    const created = await createOrder();
    await request(app).post(`/api/orders/${created.body.order_id}/approve`).set(auth(OWNER)).send({});
    const actions = ordersService._memoryAudit().map((a) => a.action);
    expect(actions).toContain('order_approved');
  });
});

describe('POST /api/orders/:id/reject', () => {
  test('owner rejects with reason; approval rejected too', async () => {
    const created = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/reject`)
      .set(auth(OWNER))
      .send({ reason: 'too expensive' });
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('rejected');
    expect(res.body.reason).toBe('too expensive');
    const approval = await approvalStore.get(created.body.approval_id);
    expect(approval.status).toBe('rejected');
    const actions = ordersService._memoryAudit().map((a) => a.action);
    expect(actions).toContain('order_rejected');
  });

  test('pm cannot reject (403)', async () => {
    const created = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/reject`)
      .set(auth(PM))
      .send({ reason: 'nope' });
    expect(res.status).toBe(403);
  });

  test('400 without a reason', async () => {
    const created = await createOrder();
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/reject`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(400);
  });

  test('rejected order is terminal — approve now 409s', async () => {
    const created = await createOrder();
    await request(app)
      .post(`/api/orders/${created.body.order_id}/reject`)
      .set(auth(OWNER))
      .send({ reason: 'no' });
    const res = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(409);
  });
});

describe('GET /api/orders/:id/status + GET /api/orders', () => {
  test('status returns full order detail with items and approval state', async () => {
    const created = await createOrder();
    const res = await request(app)
      .get(`/api/orders/${created.body.order_id}/status`)
      .set(auth(PM));
    expect(res.status).toBe(200);
    expect(res.body.status).toBe('draft');
    expect(res.body.supplier).toBe('home_depot');
    expect(res.body.items).toHaveLength(2);
    expect(res.body.items[0].name).toBeDefined();
    expect(res.body.approval_status).toBe('pending');
    expect(res.body.eta).toBeNull();
    expect(res.body.created_by).toBe(PM.userId);
  });

  test('field can view status (view-only role)', async () => {
    const created = await createOrder();
    const res = await request(app)
      .get(`/api/orders/${created.body.order_id}/status`)
      .set(auth(FIELD));
    expect(res.status).toBe(200);
  });

  test('404 for unknown order', async () => {
    const res = await request(app).get(`/api/orders/${PROJECT_ID}/status`).set(auth(OWNER));
    expect(res.status).toBe(404);
  });

  test('list filters by status', async () => {
    await createOrder();
    const second = await createOrder();
    await request(app).post(`/api/orders/${second.body.order_id}/approve`).set(auth(OWNER)).send({});
    const drafts = await request(app).get('/api/orders').query({ status: 'draft' }).set(auth(PM));
    expect(drafts.body.count).toBe(1);
    expect(drafts.body.orders[0].status).toBe('draft');
    const all = await request(app).get('/api/orders').set(auth(PM));
    expect(all.body.count).toBe(2);
  });
});

describe('GATE: end-to-end create → approve → track', () => {
  test('full flow persists every state transition', async () => {
    const created = await request(app)
      .post('/api/orders')
      .set(auth(PM))
      .send({ account_id: ACCOUNT_ID, materials: [{ material_id: PANEL, qty: 1 }] });
    expect(created.status).toBe(201);
    expect(created.body.approval_pending).toBe(true);

    const approved = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(approved.body.status).toBe('submitted');

    const status = await request(app)
      .get(`/api/orders/${created.body.order_id}/status`)
      .set(auth(FIELD));
    expect(status.body.status).toBe('submitted');
    expect(status.body.approval_status).toBe('approved');
    expect(status.body.submitted_at).toBeTruthy();

    const actions = ordersService._memoryAudit().map((a) => a.action);
    expect(actions).toEqual(expect.arrayContaining(['order_created', 'order_approved']));
  });
});
