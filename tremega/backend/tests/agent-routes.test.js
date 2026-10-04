// tests/agent-routes.test.js
// Week 3: /api/agent routes — validation, auth, RBAC, approval workflow.
// Everything external is mocked: Anthropic SDK, Supabase (driven into the
// in-memory fallback via missing-table errors), JWTs signed with a test secret.

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');

const claudeService = require('../src/services/claude-service');
const approvalStore = require('../src/services/approval-store');
const registry = require('../src/tools/registry');
const agentRouter = require('../routes/agent');

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';

// Legacy roles map through rbac.js: admin -> owner, contractor -> pm, sub -> field
const OWNER = { userId: 'u-owner', role: 'admin' };
const PM = { userId: 'u-pm', role: 'contractor' };
const FIELD = { userId: 'u-field', role: 'sub' };

const sign = (payload) => jwt.sign(payload, process.env.JWT_SECRET);
const auth = (payload) => ({ Authorization: `Bearer ${sign(payload)}` });

const VALID_ORDER_INPUT = {
  project_id: PROJECT_ID,
  items: [{ description: '12/2 NM-B wire, 250ft', quantity: 5, unit_cost: 89.99 }],
  supplier: 'Home Depot',
  deliver_by: '2026-09-25',
};

// Supabase mock whose every operation fails with a missing-table error,
// exercising the approval-store / audit-log in-memory fallback path.
const missingTableError = { message: 'relation "tool_approvals" does not exist', code: '42P01' };
const makeErrorSupabase = () => {
  const resolve = () => Promise.resolve({ data: null, error: missingTableError });
  const chain = {};
  ['select', 'eq', 'in', 'order', 'limit', 'insert', 'update'].forEach((m) => {
    chain[m] = () => chain;
  });
  chain.single = resolve;
  chain.then = (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected);
  return { from: () => chain };
};

const textResponse = (text) => ({
  stop_reason: 'end_turn',
  content: [{ type: 'text', text }],
  usage: { input_tokens: 10, output_tokens: 5 },
});

const app = express();
app.use(express.json());
app.use('/api/agent', agentRouter);

beforeEach(() => {
  approvalStore._clearMemory();
  registry.setSupabase(makeErrorSupabase()); // propagates to approvalStore + auditLog
  claudeService.setSupabaseClient(makeErrorSupabase());
});

afterEach(() => {
  claudeService.setAnthropicClient(null);
});

describe('POST /api/agent/chat validation', () => {
  test('400 with structured issues when message is missing', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .set(auth(OWNER))
      .send({ projectId: PROJECT_ID });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(Array.isArray(res.body.error.issues)).toBe(true);
    expect(res.body.error.issues.length).toBeGreaterThan(0);
  });

  test('400 when projectId is not a uuid', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .set(auth(OWNER))
      .send({ projectId: 'not-a-uuid', message: 'hello' });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });

  test('400 when message exceeds 4000 chars', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .set(auth(OWNER))
      .send({ projectId: PROJECT_ID, message: 'x'.repeat(4001) });
    expect(res.status).toBe(400);
  });

  test('401 without an authorization token', async () => {
    const res = await request(app)
      .post('/api/agent/chat')
      .send({ projectId: PROJECT_ID, message: 'hello' });
    expect(res.status).toBe(401);
  });
});

describe('POST /api/agent/chat happy path', () => {
  test('returns reply, toolCalls and usage from the agent', async () => {
    claudeService.setAnthropicClient({
      messages: { create: async () => textResponse('Sure — here is the wire sizing.') },
    });
    const res = await request(app)
      .post('/api/agent/chat')
      .set(auth(FIELD))
      .send({ projectId: PROJECT_ID, message: 'What wire size for a 20A outlet?' });
    expect(res.status).toBe(200);
    expect(res.body.reply).toMatch(/wire sizing/i);
    expect(Array.isArray(res.body.toolCalls)).toBe(true);
    expect(res.body.usage).toBeDefined();
  });
});

describe('approval workflow', () => {
  const createPending = () =>
    approvalStore.create({
      tool_name: 'order_materials',
      input: VALID_ORDER_INPUT,
      summary: 'PO: 5x 12/2 NM-B wire',
      project_id: PROJECT_ID,
      requested_by: OWNER.userId,
    });

  test('field role cannot approve (403)', async () => {
    const approval = await createPending();
    const res = await request(app)
      .post(`/api/agent/approvals/${approval.id}/approve`)
      .set(auth(FIELD))
      .send({});
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });

  test('owner approve executes the gated action and records the result', async () => {
    const approval = await createPending();
    const res = await request(app)
      .post(`/api/agent/approvals/${approval.id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(200);
    expect(res.body.approval.status).toBe('approved');
    expect(res.body.approval.decided_by).toBe(OWNER.userId);
    expect(res.body.result).toBeDefined();
    expect(res.body.result.error).toBeUndefined();
  });

  test('pm can reject with a reason and the action is NOT executed', async () => {
    const approval = await createPending();
    const res = await request(app)
      .post(`/api/agent/approvals/${approval.id}/reject`)
      .set(auth(PM))
      .send({ reason: 'too expensive' });
    expect(res.status).toBe(200);
    expect(res.body.approval.status).toBe('rejected');
    expect(res.body.approval.reason).toBe('too expensive');
    expect(res.body.approval.result).toBeFalsy();
  });

  test('approving an already-decided approval returns 409', async () => {
    const approval = await createPending();
    await request(app)
      .post(`/api/agent/approvals/${approval.id}/approve`)
      .set(auth(OWNER))
      .send({});
    const res = await request(app)
      .post(`/api/agent/approvals/${approval.id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('ALREADY_DECIDED');
  });

  test('GET /approvals lists pending approvals for a project', async () => {
    await createPending();
    const res = await request(app)
      .get('/api/agent/approvals')
      .query({ projectId: PROJECT_ID, status: 'pending' })
      .set(auth(FIELD));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.approvals)).toBe(true);
    expect(res.body.approvals.length).toBe(1);
    expect(res.body.approvals[0].tool_name).toBe('order_materials');
  });

  test('approval store falls back to memory when supabase errors (no crash)', async () => {
    approvalStore.setSupabase(makeErrorSupabase());
    const rec = await createPending();
    const got = await approvalStore.get(rec.id);
    expect(got).toBeTruthy();
    expect(got.id).toBe(rec.id);
    expect(got.status).toBe('pending');
  });
});

describe('GET /api/agent/audit', () => {
  test('owner can read the audit log', async () => {
    const res = await request(app).get('/api/agent/audit').set(auth(OWNER));
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.audit)).toBe(true);
  });

  test('pm is forbidden from the audit log', async () => {
    const res = await request(app).get('/api/agent/audit').set(auth(PM));
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('FORBIDDEN');
  });
});
