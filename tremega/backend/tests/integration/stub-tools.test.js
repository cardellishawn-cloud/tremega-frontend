// tests/integration/stub-tools.test.js
// Bidding + scheduling layer: the 7 formerly-stubbed tools now execute real
// logic against the stores (memory-shadow mode — no live db in npm test).

const registry = require('../../src/tools/registry');
const bidsStore = require('../../src/services/bids-store');
const ordersService = require('../../src/services/orders-service');
const approvalStore = require('../../src/services/approval-store');

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174001';
const GFCI = '50000000-0000-4000-8000-000000000013'; // $18.00
const PANEL = '50000000-0000-4000-8000-000000000009'; // $145.00

// Chainable table-behavior supabase mock for the phases/conflict tests.
const makeTableMock = (rowsByTable = {}) => ({
  from: (table) => {
    const rows = rowsByTable[table] || [];
    const resolve = () => Promise.resolve({ data: rows, error: null });
    const chain = {};
    ['select', 'eq', 'in', 'order', 'limit', 'update'].forEach((m) => {
      chain[m] = () => chain;
    });
    chain.single = () => Promise.resolve({ data: rows[0] || null, error: null });
    chain.insert = (row) => Promise.resolve({ data: [row], error: null });
    chain.then = (onF, onR) => resolve().then(onF, onR);
    return chain;
  },
});

beforeEach(() => {
  registry.setSupabase(null); // pure memory mode everywhere
  bidsStore._clearMemory();
  ordersService._clearMemory();
  approvalStore._clearMemory();
});

describe('generate_scope_doc', () => {
  test('builds an SOW string from scope items', async () => {
    const r = await registry.getTool('generate_scope_doc').execute({
      project_id: PROJECT_ID,
      scope_items: ['3-bedroom kitchen remodel', 'new electrical panel'],
    });
    expect(r.error).toBeUndefined();
    expect(r.scope_doc).toMatch(/SCOPE OF WORK/);
    expect(r.scope_doc).toMatch(/kitchen remodel/);
    expect(r.item_count).toBe(2);
    expect(['low', 'medium', 'high']).toContain(r.estimated_complexity);
  });

  test('empty scope_items → validation error', async () => {
    const r = await registry.getTool('generate_scope_doc').execute({
      project_id: PROJECT_ID,
      scope_items: [],
    });
    // zod may reject min-1 arrays, or the executor flags empties — either way error
    expect(r.error).toBeDefined();
  });
});

describe('estimate_labor', () => {
  test('electrical role bills at $75/hr, general at $50/hr', async () => {
    const r = await registry.getTool('estimate_labor').execute({
      project_id: PROJECT_ID,
      tasks: [
        { description: 'Panel install', role: 'electrician', hours: 40 },
        { description: 'Cleanup', role: 'general', hours: 2 },
      ],
    });
    expect(r.error).toBeUndefined();
    expect(r.phases[0].rate).toBe(75);
    expect(r.phases[1].rate).toBe(50);
  });

  test('"new panel" scenario: 40h @ $75 = $3000', async () => {
    const r = await registry.getTool('estimate_labor').execute({
      project_id: PROJECT_ID,
      tasks: [{ description: 'new panel install', role: 'electrician', hours: 40 }],
    });
    expect(r.total_cost).toBe(3000);
    expect(r.total_hours).toBe(40);
  });

  test('explicit per-task rate wins over defaults', async () => {
    const r = await registry.getTool('estimate_labor').execute({
      project_id: PROJECT_ID,
      tasks: [{ description: 'Specialty work', role: 'electrician', hours: 4, rate: 120 }],
    });
    expect(r.phases[0].rate).toBe(120);
    expect(r.total_cost).toBe(480);
  });

  test('totals sum across mixed tasks', async () => {
    const r = await registry.getTool('estimate_labor').execute({
      project_id: PROJECT_ID,
      tasks: [
        { description: 'Wiring', role: 'electrician', hours: 10 }, // 750
        { description: 'Framing', role: 'general', hours: 10 }, // 500
      ],
    });
    expect(r.total_cost).toBe(1250);
    expect(r.total_hours).toBe(20);
  });
});

describe('generate_bid_doc', () => {
  const bidInput = {
    project_id: PROJECT_ID,
    material_estimate: { total_cost: 500 },
    labor_estimate: { total_cost: 300 },
    markup_percent: 10,
  };

  test('creates a draft bid with 10% contingency and pending approval', async () => {
    const r = await registry.getTool('generate_bid_doc').execute(bidInput);
    expect(r.error).toBeUndefined();
    expect(r.status).toBe('draft');
    expect(r.bid_id).toBeDefined();
    expect(r.total_estimate).toBe(880); // (500+300) * 1.1
    expect(r.breakdown).toEqual({
      materials: 500, labor: 300, contingency_pct: 10, contingency_amount: 80,
    });
    expect(r.note).toMatch(/human review/i);
    const approval = await approvalStore.get(r.approval_id);
    expect(approval.status).toBe('pending');
    expect(approval.input.bid_id).toBe(r.bid_id);
    const bid = await bidsStore.getBid(r.bid_id);
    expect(bid.status).toBe('draft');
  });

  test('defaults contingency to 10% when markup omitted', async () => {
    const r = await registry.getTool('generate_bid_doc').execute({
      project_id: PROJECT_ID,
      material_estimate: { total_cost: 200 },
      labor_estimate: { total_cost: 200 },
    });
    expect(r.breakdown.contingency_pct).toBe(10);
    expect(r.breakdown.contingency_amount).toBe(40);
    expect(r.total_estimate).toBe(440);
  });

  test('custom markup percent is applied', async () => {
    const r = await registry.getTool('generate_bid_doc').execute({ ...bidInput, markup_percent: 15 });
    expect(r.breakdown.contingency_amount).toBe(120);
    expect(r.total_estimate).toBe(920);
  });

  test('approving the bid approval marks the bid won', async () => {
    const r = await registry.getTool('generate_bid_doc').execute(bidInput);
    const approval = await approvalStore.get(r.approval_id);
    const result = await registry.executeApproved('generate_bid_doc', approval.input, {
      approval_id: approval.id,
      user_id: 'u-owner',
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe('executed');
    expect(result.bid_status).toBe('won');
    const bid = await bidsStore.getBid(r.bid_id);
    expect(bid.status).toBe('won');
    expect(bid.won_at).toBeTruthy();
  });
});

describe('analyze_blueprints', () => {
  test('returns the MVP mock specs consistently', async () => {
    const input = { project_id: PROJECT_ID, file_urls: ['https://x/plan1.pdf', 'https://x/plan2.pdf'] };
    const a = await registry.getTool('analyze_blueprints').execute(input);
    const b = await registry.getTool('analyze_blueprints').execute(input);
    expect(a.dimensions).toEqual({ rooms: 3, sqft: 2400 });
    expect(a.fixtures).toBe(15);
    expect(a.complexity_score).toBe(7);
    expect(a.files_analyzed).toBe(2);
    expect(a).toEqual(b);
  });
});

describe('create_phase', () => {
  test('creates a planned phase with computed duration', async () => {
    const r = await registry.getTool('create_phase').execute({
      project_id: PROJECT_ID,
      name: 'Framing',
      start_date: '2026-10-01',
      end_date: '2026-10-15',
    });
    expect(r.error).toBeUndefined();
    expect(r.status).toBe('planned');
    expect(r.phase_id).toMatch(/^[0-9a-f-]{36}$/);
    expect(r.duration_days).toBe(14);
  });

  test('rejects end_date before start_date', async () => {
    const r = await registry.getTool('create_phase').execute({
      project_id: PROJECT_ID,
      name: 'Backwards',
      start_date: '2026-10-15',
      end_date: '2026-10-01',
    });
    expect(r.error).toBeDefined();
    expect(r.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('check_conflicts', () => {
  const phases = [
    {
      id: 'p1', project_id: PROJECT_ID, name: 'Framing', start_date: '2026-10-05', end_date: '2026-10-12',
    },
    {
      id: 'p2', project_id: PROJECT_ID, name: 'Roofing', start_date: '2026-11-01', end_date: '2026-11-10',
    },
  ];

  test('returns overlapping phases as conflicts', async () => {
    registry.setSupabase(makeTableMock({ phases }));
    const r = await registry.getTool('check_conflicts').execute({
      project_id: PROJECT_ID,
      start_date: '2026-10-10',
      end_date: '2026-10-20',
    });
    expect(r.has_conflicts).toBe(true);
    expect(r.conflicts).toHaveLength(1);
    expect(r.conflicts[0].phase_name).toBe('Framing');
  });

  test('returns empty conflicts when nothing overlaps', async () => {
    registry.setSupabase(makeTableMock({ phases }));
    const r = await registry.getTool('check_conflicts').execute({
      project_id: PROJECT_ID,
      start_date: '2026-12-01',
      end_date: '2026-12-15',
    });
    expect(r.has_conflicts).toBe(false);
    expect(r.conflicts).toEqual([]);
  });
});

describe('consolidate_orders', () => {
  test('5% bulk savings on materials shared across 2+ orders', async () => {
    const a = await ordersService.createOrder({
      account_id: ACCOUNT_ID,
      project_id: PROJECT_ID,
      materials: [{ material_id: GFCI, qty: 2 }],
      created_by: 'tester',
    });
    const b = await ordersService.createOrder({
      account_id: ACCOUNT_ID,
      project_id: PROJECT_ID,
      materials: [{ material_id: GFCI, qty: 3 }],
      created_by: 'tester',
    });
    const r = await registry.getTool('consolidate_orders').execute({
      project_id: PROJECT_ID,
      order_ids: [a.order_id, b.order_id],
    });
    expect(r.error).toBeUndefined();
    const gfci = r.consolidated_materials.find((m) => m.material_id === GFCI);
    expect(gfci.total_qty).toBe(5);
    expect(gfci.separate_cost).toBe(90);
    expect(gfci.bulk_discount_applied).toBe(true);
    expect(gfci.consolidated_cost).toBe(85.5);
    expect(gfci.savings).toBe(4.5);
    expect(r.total_savings).toBe(4.5);
  });

  test('single order → no discount, zero savings', async () => {
    const a = await ordersService.createOrder({
      account_id: ACCOUNT_ID,
      project_id: PROJECT_ID,
      materials: [{ material_id: PANEL, qty: 1 }],
      created_by: 'tester',
    });
    const r = await registry.getTool('consolidate_orders').execute({
      project_id: PROJECT_ID,
      order_ids: [a.order_id],
    });
    const panel = r.consolidated_materials.find((m) => m.material_id === PANEL);
    expect(panel.bulk_discount_applied).toBe(false);
    expect(panel.savings).toBe(0);
    expect(r.total_savings).toBe(0);
  });
});
