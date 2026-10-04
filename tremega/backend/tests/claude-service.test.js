// tests/claude-service.test.js
const claudeService = require('../src/services/claude-service');

const PROJECT_ID = '123e4567-e89b-12d3-a456-426614174000';

// Chainable supabase mock: every query resolves per-table behavior.
// behavior: { [table]: { data } | { error } | { throw } }
const makeSupabaseMock = (behavior = {}) => {
  const mock = {
    inserts: [],
    from: (table) => {
      const resolve = () => {
        const b = behavior[table];
        if (b && b.throw) return Promise.reject(new Error(b.throw));
        if (b && b.error) return Promise.resolve({ data: null, error: { message: b.error } });
        return Promise.resolve({ data: (b && b.data) || [], error: null });
      };
      const chain = {};
      ['select', 'eq', 'in', 'limit', 'order'].forEach((m) => {
        chain[m] = () => chain;
      });
      chain.insert = (row) => {
        mock.inserts.push({ table, row });
        return resolve();
      };
      // Make the chain awaitable: awaiting any query yields { data, error }.
      chain.then = (onFulfilled, onRejected) => resolve().then(onFulfilled, onRejected);
      return chain;
    },
  };
  return mock;
};

// Mock Anthropic client replaying a sequence of responses.
const makeAnthropicMock = (responses) => {
  const calls = [];
  let i = 0;
  return {
    calls,
    messages: {
      create: async (params) => {
        // Snapshot — the service mutates the messages array between turns.
        calls.push(JSON.parse(JSON.stringify(params)));
        const response = responses[Math.min(i, responses.length - 1)];
        i += 1;
        return typeof response === 'function' ? response(params) : response;
      },
    },
  };
};

const textResponse = (text, stopReason = 'end_turn') => ({
  stop_reason: stopReason,
  content: [{ type: 'text', text }],
  usage: { input_tokens: 100, output_tokens: 50 },
});

const toolUseResponse = (toolCalls) => ({
  stop_reason: 'tool_use',
  content: toolCalls.map((tc, i) => ({
    type: 'tool_use',
    id: `toolu_${i}`,
    name: tc.name,
    input: tc.input,
  })),
  usage: { input_tokens: 120, output_tokens: 40 },
});

beforeEach(() => {
  claudeService.setSupabaseClient(makeSupabaseMock());
});

afterEach(() => {
  claudeService.setAnthropicClient(null);
  claudeService.setSupabaseClient(null);
});

describe('loadProjectContext', () => {
  test('pulls project state sections from supabase', async () => {
    claudeService.setSupabaseClient(makeSupabaseMock({
      bids: { data: [{ id: PROJECT_ID, title: 'Panel upgrade', status: 'sent' }] },
      phases: { data: [{ id: 'ph-1', name: 'rough-in' }] },
    }));
    const context = await claudeService.loadProjectContext(PROJECT_ID);
    expect(context.openBids).toHaveLength(1);
    expect(context.activePhases).toHaveLength(1);
    // Empty tables are omitted, not empty arrays
    expect(context.materials).toBeUndefined();
  });

  test('tolerates missing tables (query errors omit that section)', async () => {
    claudeService.setSupabaseClient(makeSupabaseMock({
      bids: { data: [{ id: PROJECT_ID, title: 'Service change' }] },
      phases: { error: 'relation "phases" does not exist' },
      materials: { error: 'relation "materials" does not exist' },
      crew: { error: 'relation "crew" does not exist' },
      tool_approvals: { error: 'relation "tool_approvals" does not exist' },
    }));
    const context = await claudeService.loadProjectContext(PROJECT_ID);
    expect(context.openBids).toHaveLength(1);
    expect(context.activePhases).toBeUndefined();
    expect(context.materials).toBeUndefined();
    expect(context.team).toBeUndefined();
    expect(context.pendingApprovals).toBeUndefined();
  });

  test('tolerates supabase throwing (network-level failure)', async () => {
    claudeService.setSupabaseClient(makeSupabaseMock({
      bids: { throw: 'fetch failed' },
      phases: { throw: 'fetch failed' },
      materials: { throw: 'fetch failed' },
      crew: { throw: 'fetch failed' },
      tool_approvals: { throw: 'fetch failed' },
      notifications: { throw: 'fetch failed' },
    }));
    const context = await claudeService.loadProjectContext(PROJECT_ID);
    expect(context).toEqual({});
  });
});

describe('runAgentTurn', () => {
  test('single-turn reply with no tool use', async () => {
    const anthropic = makeAnthropicMock([
      textResponse('Your rough-in phase starts Monday. No conflicts found.'),
    ]);
    claudeService.setAnthropicClient(anthropic);

    const result = await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'What is the schedule this week?',
    });

    expect(result.reply).toContain('rough-in');
    expect(result.toolCalls).toHaveLength(0);
    expect(anthropic.calls).toHaveLength(1);
    expect(result.usage.input_tokens).toBe(100);
    expect(result.usage.output_tokens).toBe(50);
  });

  test('multi-turn tool-use loop: estimate_materials then final text', async () => {
    const anthropic = makeAnthropicMock([
      toolUseResponse([{
        name: 'estimate_materials',
        input: {
          project_id: PROJECT_ID,
          items: [{ description: '12/2 NM-B', quantity: 250, unit: 'ft', unit_cost: 0.5 }],
        },
      }]),
      textResponse('Materials for the rough-in come to about $125.00 (low confidence until supplier pricing is connected).'),
    ]);
    claudeService.setAnthropicClient(anthropic);

    const result = await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'Estimate wire for the garage rough-in.',
    });

    expect(anthropic.calls).toHaveLength(2);
    expect(result.toolCalls).toHaveLength(1);
    expect(result.toolCalls[0].name).toBe('estimate_materials');
    expect(result.toolCalls[0].result.total_cost).toBeCloseTo(125, 2);
    expect(result.reply).toContain('$125');

    // The tool result was fed back to Claude as a tool_result user message
    const secondCallMessages = anthropic.calls[1].messages;
    const toolResultMsg = secondCallMessages[secondCallMessages.length - 1];
    expect(toolResultMsg.role).toBe('user');
    expect(toolResultMsg.content[0].type).toBe('tool_result');
    expect(toolResultMsg.content[0].tool_use_id).toBe('toolu_0');
    const fedBack = JSON.parse(toolResultMsg.content[0].content);
    expect(fedBack.line_items).toBeDefined();

    // Usage aggregated across both calls
    expect(result.usage.input_tokens).toBe(220);
    expect(result.usage.output_tokens).toBe(90);
  });

  test('self-correction: Zod validation error is fed back to Claude', async () => {
    const anthropic = makeAnthropicMock([
      toolUseResponse([{
        name: 'estimate_materials',
        input: {
          project_id: 'not-a-uuid',
          items: [{ description: 'wire', quantity: -3, unit: 'ft' }],
        },
      }]),
      toolUseResponse([{
        name: 'estimate_materials',
        input: {
          project_id: PROJECT_ID,
          items: [{ description: 'wire', quantity: 100, unit: 'ft', unit_cost: 0.5 }],
        },
      }]),
      textResponse('Corrected — 100 ft of wire comes to $50.00.'),
    ]);
    claudeService.setAnthropicClient(anthropic);

    const result = await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'How much wire do I need?',
    });

    expect(anthropic.calls).toHaveLength(3);

    // First attempt produced a structured validation error flagged is_error
    expect(result.toolCalls[0].result.error.code).toBe('VALIDATION_ERROR');
    const secondCallMessages = anthropic.calls[1].messages;
    const errResult = secondCallMessages[secondCallMessages.length - 1].content[0];
    expect(errResult.is_error).toBe(true);
    const fedBackError = JSON.parse(errResult.content);
    expect(fedBackError.error.code).toBe('VALIDATION_ERROR');
    expect(fedBackError.error.field).toBeDefined();

    // Second attempt succeeded and produced the final reply
    expect(result.toolCalls[1].result.error).toBeUndefined();
    expect(result.reply).toContain('$50');
  });

  test('approval-gated tools surface pending_approval through the loop', async () => {
    const anthropic = makeAnthropicMock([
      toolUseResponse([{
        name: 'order_materials',
        input: {
          project_id: PROJECT_ID,
          items: [{ description: '200A panel', quantity: 1, unit_cost: 450 }],
          supplier: 'CED',
        },
      }]),
      (params) => {
        // Claude sees the pending approval in the tool result and surfaces it
        const lastMsg = params.messages[params.messages.length - 1];
        const fedBack = JSON.parse(lastMsg.content[0].content);
        expect(fedBack.status).toBe('pending_approval');
        return textResponse(`I've prepared the panel order but it needs your approval (id: ${fedBack.approval_id}).`);
      },
    ]);
    claudeService.setAnthropicClient(anthropic);

    const result = await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'Order the 200A panel.',
    });

    expect(result.toolCalls[0].result.status).toBe('pending_approval');
    expect(result.reply).toContain('approval');
  });

  test('loop cap: stops after MAX_TURNS when Claude never ends the turn', async () => {
    const anthropic = makeAnthropicMock([
      toolUseResponse([{ name: 'track_delivery', input: { purchase_order_id: 'po-1' } }]),
    ]);
    claudeService.setAnthropicClient(anthropic);

    const result = await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'Keep checking deliveries.',
    });

    expect(anthropic.calls).toHaveLength(claudeService.MAX_TURNS);
    expect(result.toolCalls).toHaveLength(claudeService.MAX_TURNS);
    expect(result.reply).toMatch(/maximum number of tool-use steps/i);
  });

  test('unknown tool name returns a structured error to Claude', async () => {
    const anthropic = makeAnthropicMock([
      toolUseResponse([{ name: 'fly_to_supplier', input: {} }]),
      textResponse('Sorry, I cannot do that directly.'),
    ]);
    claudeService.setAnthropicClient(anthropic);

    const result = await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'Fly to the supplier.',
    });

    expect(result.toolCalls[0].result.error.code).toBe('UNKNOWN_TOOL');
    expect(result.reply).toContain('cannot');
  });

  test('system prompt and tools are passed to the API', async () => {
    const anthropic = makeAnthropicMock([textResponse('ok')]);
    claudeService.setAnthropicClient(anthropic);

    await claudeService.runAgentTurn({
      projectId: PROJECT_ID,
      userMessage: 'hi',
    });

    const params = anthropic.calls[0];
    expect(params.system).toContain('GUARDRAILS');
    expect(params.tools).toHaveLength(20);
    expect(params.model).toBe(process.env.CLAUDE_MODEL || 'claude-opus-4-6');
  });
});
