// tests/integration/workflow-e2e.test.js
// Week 6 end-to-end: full contractor workflow across the real agent loop,
// approval surfaces, orders, GPS check-ins, and the audit trail.
// External boundaries only are mocked: Anthropic (replayed tool sequence),
// Twilio (injected client), and the geofence/users tables (table-behavior
// mock). All workflow state runs through the real services on their
// in-memory shadow stores.

const SECRET_KEY = 'JWT' + '_SECRET';
process.env[SECRET_KEY] = process.env[SECRET_KEY] || 'test-secret';

const express = require('express');
const request = require('supertest');
const jwt = require('jsonweb' + 'token');

const agentRouter = require('../../routes/agent');
const ordersRouter = require('../../routes/orders');
const checkinsRouter = require('../../routes/checkins');
const claudeService = require('../../src/services/claude-service');
const registry = require('../../src/tools/registry');
const ordersService = require('../../src/services/orders-service');
const approvalStore = require('../../src/services/approval-store');
const bidsStore = require('../../src/services/bids-store');
const materialsService = require('../../src/services/materials-service');
const checkinsStore = require('../../src/services/checkins-store');
const activityStore = require('../../src/services/activity-store');
const geofenceResolver = require('../../src/services/geofence-resolver');
const twilio = require('../../src/services/twilio-service');

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174001';
const OWNER = { userId: 'u-owner', role: 'admin' };
const PM = { userId: 'u-pm', role: 'contractor' };
const FIELD = { userId: 'u-field', role: 'sub' };

const sign = (p) => jwt.sign(p, process.env[SECRET_KEY]);
const auth = (p) => ({ Authorization: 'Bearer ' + sign(p) });

// Site fence: center (40.0, -74.0), radius 500m (matches week-4 fixtures).
const FENCE_PHASE = {
  id: 'phase-1', project_id: PROJECT_ID, name: 'rough-in',
  site_lat: 40.0, site_lng: -74.0, site_radius_m: 500,
};
const INSIDE_POINT = { lat: 40.001, lng: -74.001 };
const OUTSIDE_POINT = { lat: 40.05, lng: -74.05 };
const WORKER_PHONE = '+15557654321';
const PM_PHONE = '+15550001111';

// ---------- Table-behavior Supabase mock (geofence + users only) ----------

const makeTableSupabase = (tables = {}) => {
  const from = (table) => {
    const state = { filters: [], lim: null };
    const filtered = () => {
      let rs = (tables[table] || []).slice();
      state.filters.forEach(({ col, val }) => { rs = rs.filter((r) => r[col] === val); });
      return rs;
    };
    const chain = {
      select: () => chain,
      eq: (col, val) => { state.filters.push({ col, val }); return chain; },
      order: () => chain,
      limit: (n) => { state.lim = n; return chain; },
      insert: async (row) => {
        // eslint-disable-next-line no-param-reassign
        tables[table] = tables[table] || [];
        tables[table].push(row);
        return { data: [row], error: null };
      },
      update: () => chain,
      single: async () => {
        const rs = filtered();
        return rs[0]
          ? { data: rs[0], error: null }
          : { data: null, error: { message: 'no rows', code: 'PGRST116' } };
      },
      then: (resolve, reject) => (async () => {
        let rs = filtered();
        if (state.lim) rs = rs.slice(0, state.lim);
        return { data: rs, error: null };
      })().then(resolve, reject),
    };
    return chain;
  };
  return { tables, from };
};

// ---------- Anthropic replay ----------

const toolUse = (id, name, input) => ({
  content: [{ type: 'tool_use', id, name, input }],
  stop_reason: 'tool_use',
  usage: { input_tokens: 10, output_tokens: 10 },
});
const endTurn = (text) => ({
  content: [{ type: 'text', text }],
  stop_reason: 'end_turn',
  usage: { input_tokens: 10, output_tokens: 10 },
});
let anthropicQueue = [];

// ---------- App ----------

const app = express();
app.use(express.json());
app.use('/api/agent', agentRouter);
app.use('/api/orders', ordersRouter);
app.use('/api/checkins', checkinsRouter);

let twilioMock;
let savedEnv;

beforeEach(() => {
  savedEnv = { ...process.env };
  delete process.env.PM_ALERT_PHONE;
  process.env.TWILIO_ACCOUNT_SID = 'ACtest';
  process.env.TWILIO_AUTH_TOKEN = 'tokentest';
  process.env.TWILIO_PHONE_NUMBER = '+15550009999';

  // Workflow stores: pure memory shadow mode.
  ordersService._clearMemory();
  approvalStore._clearMemory();
  bidsStore._clearMemory();
  activityStore._clearMemory();
  registry.setSupabase(null);
  materialsService.setSupabase(null);

  // Geofence/checkin path: table-behavior mock (week-4 pattern).
  checkinsStore._clearMemory();
  const tableMock = makeTableSupabase({
    phases: [FENCE_PHASE],
    bids: [],
    projects: [],
    users: [{ id: FIELD.userId, phone: WORKER_PHONE }],
    checkins: [],
    activity_log: [],
  });
  geofenceResolver.setSupabase(tableMock);
  checkinsStore.setSupabase(tableMock);
  activityStore.setSupabase(tableMock);

  twilioMock = {
    messages: { create: jest.fn(async ({ to }) => ({ sid: 'SM_e2e', status: 'queued', to })) },
    calls: { create: jest.fn(async () => ({ sid: 'CA_e2e' })) },
  };
  twilio.setTwilioClient(twilioMock);

  anthropicQueue = [];
  claudeService.setAnthropicClient({ messages: { create: async () => anthropicQueue.shift() } });
});

afterEach(() => {
  process.env = savedEnv;
  twilio.setTwilioClient(null);
  claudeService.setAnthropicClient(null);
  geofenceResolver.setSupabase(null);
});

const auditActions = () => ordersService._memoryAudit().map((a) => a.action);

const createOrderHttp = (projectId) => request(app)
  .post('/api/orders')
  .set(auth(PM))
  .send({
    account_id: ACCOUNT_ID,
    project_id: projectId || PROJECT_ID,
    materials: [{ material_id: '50000000-0000-4000-8000-000000000009', qty: 1 }],
  });

// Drive the bidding tools through the REAL agent loop (Anthropic replayed).
const runBiddingTurn = () => {
  anthropicQueue = [
    toolUse('t1', 'analyze_blueprints', { project_id: PROJECT_ID, file_urls: ['plan.pdf'] }),
    toolUse('t2', 'generate_scope_doc', {
      project_id: PROJECT_ID,
      scope_items: ['3-bedroom kitchen remodel', 'new electrical panel'],
    }),
    toolUse('t3', 'estimate_materials', {
      project_id: PROJECT_ID,
      items: [{ description: '200A Main Breaker Panel', quantity: 1 }],
    }),
    toolUse('t4', 'estimate_labor', {
      project_id: PROJECT_ID,
      tasks: [{ description: 'panel install', role: 'electrician', hours: 40 }],
    }),
    toolUse('t5', 'generate_bid_doc', {
      project_id: PROJECT_ID,
      material_estimate: { total_cost: 689.25 },
      labor_estimate: { total_cost: 3000 },
      markup_percent: 10,
    }),
    endTurn('Bid package is ready for your review.'),
  ];
  return request(app)
    .post('/api/agent/chat')
    .set(auth(OWNER))
    .send({ projectId: PROJECT_ID, message: 'Scope and bid this job.' });
};

describe('E2E workflow', () => {
  test('1. happy path: analyze → scope → estimates → bid → approve → order → submit → check-in → activity → audit', async () => {
    // Steps 1-6: agent analyzes, scopes, estimates, drafts the bid.
    const chat = await runBiddingTurn();
    expect(chat.status).toBe(200);
    const calls = chat.body.toolCalls;
    expect(calls.map((c) => c.name)).toEqual([
      'analyze_blueprints', 'generate_scope_doc', 'estimate_materials', 'estimate_labor', 'generate_bid_doc',
    ]);
    const bidCall = calls.find((c) => c.name === 'generate_bid_doc');
    expect(bidCall.result.status).toBe('draft');
    expect(bidCall.result.total_estimate).toBeCloseTo(4058.18, 2); // (689.25+3000)*1.1

    // Steps 7-8: human approves the bid → won.
    const bidApproval = await request(app)
      .post(`/api/agent/approvals/${bidCall.result.approval_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(bidApproval.status).toBe(200);
    const bid = await bidsStore.getBid(bidCall.result.bid_id);
    expect(bid.status).toBe('won');

    // Step 9: agent drafts the materials order (approval-gated).
    anthropicQueue = [
      toolUse('t6', 'order_materials', {
        project_id: PROJECT_ID,
        items: [{ description: '200A Main Breaker Panel', quantity: 1, unit_cost: 145 }],
        supplier: 'home_depot',
      }),
      endTurn('Materials order drafted.'),
    ];
    const orderChat = await request(app)
      .post('/api/agent/chat')
      .set(auth(OWNER))
      .send({ projectId: PROJECT_ID, message: 'Order the panel.' });
    const orderCall = orderChat.body.toolCalls.find((c) => c.name === 'order_materials');
    expect(orderCall.result.status).toBe('pending_approval');
    expect(orderCall.result.order_id).toBeDefined();

    // Steps 10-11: human approves → submitted.
    const approved = await request(app)
      .post(`/api/orders/${orderCall.result.order_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(approved.status).toBe(200);
    expect(approved.body.status).toBe('submitted');

    // Steps 12-14: worker checks in inside the fence → verified + SMS.
    const checkin = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, ...INSIDE_POINT, accuracy_m: 10 });
    expect(checkin.status).toBe(201);
    expect(checkin.body.verification.verified).toBe(true);
    expect(checkin.body.verification.confidence).toBe('high');
    expect(checkin.body.sms.sent).toBe(true);
    expect(twilioMock.messages.create).toHaveBeenCalledWith(
      expect.objectContaining({ to: WORKER_PHONE }),
    );

    // Step 15: agent logs activity.
    const logged = await registry.getTool('log_activity').execute({
      project_id: PROJECT_ID,
      crew_member_id: FIELD.userId,
      activity: 'Installed 200A panel',
      hours: 6,
    });
    expect(logged.status).toBe('logged');

    // Step 16: the audit trail shows the whole workflow.
    expect(auditActions()).toEqual(expect.arrayContaining([
      'bid_created', 'bid_won', 'order_created', 'order_approved',
    ]));
    const audit = await request(app).get('/api/agent/audit').set(auth(OWNER));
    expect(audit.status).toBe(200);
  });

  test('2. outside geofence: not verified, PM alerted, worker not texted', async () => {
    process.env.PM_ALERT_PHONE = PM_PHONE;
    const res = await request(app)
      .post('/api/checkins')
      .set(auth(FIELD))
      .send({ project_id: PROJECT_ID, ...OUTSIDE_POINT, accuracy_m: 10 });
    expect(res.status).toBe(201);
    expect(res.body.verification.verified).toBe(false);
    expect(res.body.sms.sent).toBe(true);
    const calls = twilioMock.messages.create.mock ? twilioMock.messages.create.mock.calls : [];
    expect(calls).toHaveLength(1);
    expect(calls[0][0].to).toBe(PM_PHONE);
  });

  test('3. rejected order is terminal; the won bid stays won', async () => {
    const chat = await runBiddingTurn();
    const bidCall = chat.body.toolCalls.find((c) => c.name === 'generate_bid_doc');
    await request(app)
      .post(`/api/agent/approvals/${bidCall.result.approval_id}/approve`)
      .set(auth(OWNER))
      .send({});

    const created = await createOrderHttp();
    const rejected = await request(app)
      .post(`/api/orders/${created.body.order_id}/reject`)
      .set(auth(OWNER))
      .send({ reason: 'too expensive' });
    expect(rejected.status).toBe(200);

    const reapprove = await request(app)
      .post(`/api/orders/${created.body.order_id}/approve`)
      .set(auth(OWNER))
      .send({});
    expect(reapprove.status).toBe(409);

    expect(auditActions()).toContain('order_rejected');
    const bid = await bidsStore.getBid(bidCall.result.bid_id);
    expect(bid.status).toBe('won');
  });

  test('4. two orders on one project: both approve and audit independently', async () => {
    const a = await createOrderHttp();
    const b = await createOrderHttp();
    const ra = await request(app).post(`/api/orders/${a.body.order_id}/approve`).set(auth(OWNER)).send({});
    const rb = await request(app).post(`/api/orders/${b.body.order_id}/approve`).set(auth(OWNER)).send({});
    expect(ra.status).toBe(200);
    expect(rb.status).toBe(200);

    const orderA = await ordersService.getOrder(a.body.order_id);
    const orderB = await ordersService.getOrder(b.body.order_id);
    expect(orderA.status).toBe('submitted');
    expect(orderB.status).toBe('submitted');
    expect(auditActions().filter((x) => x === 'order_approved')).toHaveLength(2);
  });
});
