// tests/tools.test.js
const registry = require('../src/tools/registry');
const ordersService = require('../src/services/orders-service');

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';
const ACCOUNT_ID = '123e4567-e89b-12d3-a456-426614174001';
const GFCI_ID = '50000000-0000-4000-8000-000000000013';

// Records inserts per table; can be configured to fail per table.
const makeSupabaseMock = (failTables = []) => {
  const inserts = [];
  return {
    inserts,
    from: (table) => ({
      insert: async (row) => {
        inserts.push({ table, row });
        if (failTables.includes(table)) {
          return { data: null, error: { message: `relation "${table}" does not exist` } };
        }
        return { data: [row], error: null };
      },
    }),
  };
};

describe('tool registry', () => {
  beforeEach(() => {
    registry.setSupabase(makeSupabaseMock());
  });

  afterEach(() => {
    registry.setSupabase(null);
  });

  test('all 20 tools are registered with valid name/description/input_schema', () => {
    const tools = registry.listTools();
    expect(tools).toHaveLength(20);
    tools.forEach((name) => {
      const tool = registry.getTool(name);
      expect(tool).toBeDefined();
      expect(typeof tool.name).toBe('string');
      expect(tool.name).toMatch(/^[a-z][a-z0-9_]*$/);
      expect(typeof tool.description).toBe('string');
      expect(tool.description.length).toBeGreaterThan(10);
      expect(tool.input_schema).toBeDefined();
      expect(tool.input_schema.type).toBe('object');
      expect(tool.input_schema.properties).toBeDefined();
    });
  });

  test('every tool has a Zod schema and an execute function', () => {
    registry.listTools().forEach((name) => {
      const tool = registry.getTool(name);
      expect(tool.zodSchema).toBeDefined();
      expect(typeof tool.zodSchema.safeParse).toBe('function');
      expect(typeof tool.execute).toBe('function');
    });
  });

  test('getToolDefinitions returns Anthropic API shape (name/description/input_schema only)', () => {
    const defs = registry.getToolDefinitions();
    expect(defs).toHaveLength(20);
    defs.forEach((def) => {
      expect(Object.keys(def).sort()).toEqual(['description', 'input_schema', 'name']);
    });
  });

  test('estimate_materials rejects negative quantity with structured error', async () => {
    const result = await registry.getTool('estimate_materials').execute({
      project_id: PROJECT_ID,
      items: [{ description: '12/2 NM-B wire', quantity: -5, unit: 'ft' }],
    });
    expect(result.error).toBeDefined();
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(typeof result.error.message).toBe('string');
    expect(result.error.field).toContain('quantity');
  });

  test('estimate_materials rejects missing items with structured error', async () => {
    const result = await registry.getTool('estimate_materials').execute({ project_id: PROJECT_ID });
    expect(result.error.code).toBe('VALIDATION_ERROR');
  });

  test('geofence_check rejects out-of-range latitude', async () => {
    const result = await registry.getTool('geofence_check').execute({
      project_id: PROJECT_ID,
      latitude: 123,
      longitude: -80,
    });
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.field).toContain('latitude');
  });

  test('notify_via_twilio rejects malformed phone numbers', async () => {
    const result = await registry.getTool('notify_via_twilio').execute({
      to_phone: 'not-a-phone',
      message: 'hello',
    });
    expect(result.error.code).toBe('VALIDATION_ERROR');
    expect(result.error.field).toBe('to_phone');
  });

  test('estimate_materials returns line_items, total_cost, and confidence', async () => {
    const result = await registry.getTool('estimate_materials').execute({
      project_id: PROJECT_ID,
      items: [
        { description: '12/2 NM-B wire', quantity: 250, unit: 'ft', unit_cost: 0.5 },
        { description: '20A breakers', quantity: 8, unit: 'ea', unit_cost: 12 },
      ],
    });
    expect(result.error).toBeUndefined();
    expect(Array.isArray(result.line_items)).toBe(true);
    expect(result.line_items).toHaveLength(2);
    expect(result.total_cost).toBeCloseTo(221, 2);
    expect(typeof result.confidence).toBe('number');
  });

  test('estimate_labor returns hours and cost totals', async () => {
    const result = await registry.getTool('estimate_labor').execute({
      project_id: PROJECT_ID,
      tasks: [{ description: 'Rough-in', role: 'journeyman', hours: 16, rate: 85 }],
    });
    expect(result.total_hours).toBe(16);
    expect(result.total_cost).toBe(1360);
  });
});

describe('approval gates', () => {
  let mock;
  beforeEach(() => {
    mock = makeSupabaseMock();
    registry.setSupabase(mock);
  });

  afterEach(() => {
    registry.setSupabase(null);
  });

  test('order_materials returns pending_approval and never executes', async () => {
    const result = await registry.getTool('order_materials').execute({
      project_id: PROJECT_ID,
      items: [{ description: '200A panel', quantity: 1, unit_cost: 450 }],
      supplier: 'CED',
    });
    expect(result.status).toBe('pending_approval');
    expect(result.approval_id).toBeDefined();
    expect(result.summary).toContain('200A panel');
    // A pending approval was recorded
    const approvalInserts = mock.inserts.filter((i) => i.table === 'tool_approvals');
    expect(approvalInserts).toHaveLength(1);
    expect(approvalInserts[0].row.status).toBe('pending');
    // No purchase order / side-effect table was touched
    expect(mock.inserts.filter((i) => i.table === 'purchase_orders')).toHaveLength(0);
  });

  test('assign_crew returns pending_approval and never executes', async () => {
    const result = await registry.getTool('assign_crew').execute({
      project_id: PROJECT_ID,
      phase_id: 'phase-1',
      crew_member_ids: ['mike', 'luis'],
    });
    expect(result.status).toBe('pending_approval');
    expect(result.approval_id).toBeDefined();
    expect(result.summary).toContain('2 crew');
  });

  test('schedule_crew returns pending_approval and never executes', async () => {
    const result = await registry.getTool('schedule_crew').execute({
      project_id: PROJECT_ID,
      crew_member_ids: ['mike'],
      date: '2026-09-20',
      start_time: '07:00',
    });
    expect(result.status).toBe('pending_approval');
    expect(result.approval_id).toBeDefined();
    expect(result.summary).toContain('2026-09-20');
  });

  test('approval gate still works when tool_approvals table is missing (uuid placeholder)', async () => {
    registry.setSupabase(makeSupabaseMock(['tool_approvals', 'tool_audit_log']));
    const result = await registry.getTool('order_materials').execute({
      project_id: PROJECT_ID,
      items: [{ description: 'wire', quantity: 100, unit_cost: 0.5 }],
    });
    expect(result.status).toBe('pending_approval');
    expect(result.approval_id).toMatch(/^[0-9a-f-]{36}$/);
  });

  test('generate_bid_doc returns status draft (never sent)', async () => {
    const result = await registry.getTool('generate_bid_doc').execute({
      project_id: PROJECT_ID,
      markup_percent: 15,
    });
    expect(result.status).toBe('draft');
    expect(result.note).toMatch(/human review/i);
  });
});

describe('audit logging', () => {
  afterEach(() => {
    registry.setSupabase(null);
    ordersService._clearMemory();
  });

  test('successful executions write to tool_audit_log when the table exists', async () => {
    const mock = makeSupabaseMock();
    registry.setSupabase(mock);
    // The order itself lives in the memory shadow store; the tool audit log
    // writes to the mocked table.
    ordersService.setSupabase(null);
    const created = await ordersService.createOrder({
      account_id: ACCOUNT_ID,
      materials: [{ material_id: GFCI_ID, qty: 1 }],
      created_by: 'tester',
    });
    await registry.getTool('track_delivery').execute({ purchase_order_id: created.order_id });
    const auditInserts = mock.inserts.filter((i) => i.table === 'tool_audit_log');
    expect(auditInserts).toHaveLength(1);
    expect(auditInserts[0].row.tool_name).toBe('track_delivery');
    expect(auditInserts[0].row.status).toBe('ok');
  });

  test('executors tolerate a missing tool_audit_log table', async () => {
    registry.setSupabase(makeSupabaseMock(['tool_audit_log']));
    ordersService.setSupabase(null);
    const created = await ordersService.createOrder({
      account_id: ACCOUNT_ID,
      materials: [{ material_id: GFCI_ID, qty: 2 }],
      created_by: 'tester',
    });
    const result = await registry.getTool('track_delivery').execute({ purchase_order_id: created.order_id });
    expect(result.error).toBeUndefined();
    expect(result.purchase_order_id).toBe(created.order_id);
    expect(result.status).toBe('draft');
  });

  test('executors tolerate supabase throwing on audit insert', async () => {
    registry.setSupabase({
      from: () => ({
        insert: async () => { throw new Error('connection refused'); },
      }),
    });
    const result = await registry.getTool('log_activity').execute({
      project_id: PROJECT_ID,
      activity: 'Pulled 250ft of 12/2',
      hours: 3,
    });
    expect(result.error).toBeUndefined();
    expect(result.status).toBe('logged');
  });
});
