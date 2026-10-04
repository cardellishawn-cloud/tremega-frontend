// tests/integration/concurrency.test.js
// Atomic approval transitions: under concurrent load exactly one decider
// wins, the rest get 409, and the resource changes state exactly once.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const agentRouter = require('../../routes/agent');
const ordersRouter = require('../../routes/orders');
const ordersService = require('../../src/services/orders-service');
const approvalStore = require('../../src/services/approval-store');
const approvalService = require('../../src/services/approval-service');
const bidsStore = require('../../src/services/bids-store');
const materialsService = require('../../src/services/materials-service');
const registry = require('../../src/tools/registry');

const ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174001';
const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const GFCI = '50000000-0000-4000-8000-000000000013';

const OWNER = { userId: 'u-owner', role: 'admin' };
const PM = { userId: 'u-pm', role: 'contractor' };

const sign = (p) => jwt.sign(p, process.env.JWT_SECRET);
const auth = (p) => ({ Authorization: `Bearer ${sign(p)}` });

const app = express();
app.use(express.json());
app.use('/api/agent', agentRouter);
app.use('/api/orders', ordersRouter);

beforeEach(() => {
  ordersService._clearMemory();
  approvalStore._clearMemory();
  bidsStore._clearMemory();
  ordersService.setSupabase(null);
  approvalStore.setSupabase(null);
  bidsStore.setSupabase(null);
  materialsService.setSupabase(null);
  registry.setSupabase(null);
});

const auditCount = (action) => ordersService._memoryAudit().filter((a) => a.action === action).length;

const createOrderWithApproval = async () => {
  const res = await request(app)
    .post('/api/orders')
    .set(auth(PM))
    .send({ account_id: ACCOUNT_ID, project_id: PROJECT_ID, materials: [{ material_id: GFCI, qty: 2 }] });
  return res.body;
};

describe('atomic approval transitions', () => {
  test('1. concurrent bid approvals: exactly one wins, bid won once', async () => {
    const bidResult = await registry.getTool('generate_bid_doc').execute({
      project_id: PROJECT_ID,
      material_estimate: { total_cost: 500 },
      labor_estimate: { total_cost: 300 },
      markup_percent: 10,
    });
    const approvalId = bidResult.approval_id;

    const [r1, r2] = await Promise.all([
      request(app).post(`/api/agent/approvals/${approvalId}/approve`).set(auth(OWNER)).send({}),
      request(app).post(`/api/agent/approvals/${approvalId}/approve`).set(auth(OWNER)).send({}),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const bid = await bidsStore.getBid(bidResult.bid_id);
    expect(bid.status).toBe('won');
    expect(auditCount('bid_won')).toBe(1);

    const approval = await approvalStore.get(approvalId);
    expect(approval.status).toBe('approved');
  });

  test('2. concurrent order approvals: exactly one wins, submitted once', async () => {
    const { order_id } = await createOrderWithApproval();

    const [r1, r2] = await Promise.all([
      request(app).post(`/api/orders/${order_id}/approve`).set(auth(OWNER)).send({}),
      request(app).post(`/api/orders/${order_id}/approve`).set(auth(OWNER)).send({}),
    ]);
    const statuses = [r1.status, r2.status].sort();
    expect(statuses).toEqual([200, 409]);

    const order = await ordersService.getOrder(order_id);
    expect(order.status).toBe('submitted');
    expect(auditCount('order_approved')).toBe(1);
  });

  test('3. concurrent approve + reject: exactly one decision lands', async () => {
    const { order_id } = await createOrderWithApproval();

    const [approveRes, rejectRes] = await Promise.all([
      request(app).post(`/api/orders/${order_id}/approve`).set(auth(OWNER)).send({}),
      request(app).post(`/api/orders/${order_id}/reject`).set(auth(OWNER)).send({ reason: 'racing' }),
    ]);
    const statuses = [approveRes.status, rejectRes.status].sort();
    expect(statuses).toEqual([200, 409]);

    const order = await ordersService.getOrder(order_id);
    expect(['submitted', 'rejected']).toContain(order.status);
    // Exactly one terminal side effect happened.
    expect(auditCount('order_approved') + auditCount('order_rejected')).toBe(1);
  });

  test('4. ten concurrent approves: 1 succeeds, 9 get 409', async () => {
    const { order_id } = await createOrderWithApproval();

    const results = await Promise.all(
      Array.from({ length: 10 }, () => request(app)
        .post(`/api/orders/${order_id}/approve`)
        .set(auth(OWNER))
        .send({})),
    );
    const ok = results.filter((r) => r.status === 200);
    const conflicts = results.filter((r) => r.status === 409);
    expect(ok).toHaveLength(1);
    expect(conflicts).toHaveLength(9);

    const order = await ordersService.getOrder(order_id);
    expect(order.status).toBe('submitted');
    expect(auditCount('order_approved')).toBe(1);
  });

  test('the same guard serves the agent surface (direct service race)', async () => {
    const { approval_id } = await createOrderWithApproval();
    const [a, b] = await Promise.all([
      approvalService.approveApprovalAtomic(approval_id, 'u-owner'),
      approvalService.approveApprovalAtomic(approval_id, 'u-owner'),
    ]);
    const outcomes = [a, b].map((r) => (r.error ? r.http_status : 200)).sort();
    expect(outcomes).toEqual([200, 409]);
    expect(auditCount('order_approved')).toBe(1);
  });
});
