// src/services/claude-service.js
// Claude API wrapper + agentic tool-use loop for the Tremega Contractor OS agent.

const { buildSystemPrompt } = require('../prompts/system');
const registry = require('../tools/registry');

const MAX_TURNS = 10;
const DEFAULT_MODEL = 'claude-opus-4-6';
const MAX_TOKENS = 4096;

// ---------- Injectable clients (for tests) ----------

let injectedAnthropic = null;
let injectedSupabase = null;

// Inject a mock Anthropic client (tests). Pass null to reset.
const setAnthropicClient = (client) => {
  injectedAnthropic = client;
};

// Inject a mock Supabase client (tests). Pass null to reset.
const setSupabaseClient = (client) => {
  injectedSupabase = client;
  registry.setSupabase(client);
};

// Lazily create the Anthropic client. API key is read at call time so this
// module loads fine without ANTHROPIC_API_KEY set.
let defaultAnthropic = null;
const getAnthropicClient = () => {
  if (injectedAnthropic) return injectedAnthropic;
  if (!defaultAnthropic) {
    // eslint-disable-next-line global-require
    const Anthropic = require('@anthropic-ai/sdk');
    defaultAnthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  }
  return defaultAnthropic;
};

const getSupabaseClient = () => {
  if (injectedSupabase) return injectedSupabase;
  try {
    // eslint-disable-next-line global-require
    return require('../lib/supabase');
  } catch (err) {
    return null;
  }
};

const getModel = () => process.env.CLAUDE_MODEL || DEFAULT_MODEL;

// ---------- Project context ----------

// Pull current project state from Supabase, tolerating missing tables.
// Each query is wrapped so a failure omits that section instead of throwing.
const loadProjectContext = async (projectId) => {
  const supabase = getSupabaseClient();
  const context = {};
  if (!supabase) return context;

  const safeQuery = async (key, queryFn) => {
    try {
      const { data, error } = await queryFn();
      if (error) {
        console.warn(`loadProjectContext: ${key} query skipped: ${error.message}`);
        return;
      }
      if (data && data.length > 0) context[key] = data;
    } catch (err) {
      console.warn(`loadProjectContext: ${key} query failed: ${err.message}`);
    }
  };

  const byProject = (table) =>
    supabase.from(table).select('*').eq('project_id', projectId);

  await safeQuery('openBids', () =>
    projectId
      ? supabase.from('bids').select('*').eq('id', projectId)
      : supabase.from('bids').select('*').in('status', ['draft', 'sent']).limit(20));

  // Tables from migrations 007-010 — may not exist yet.
  await safeQuery('activePhases', () => byProject('phases'));
  await safeQuery('materials', () => byProject('materials'));
  await safeQuery('team', () => byProject('crew'));
  await safeQuery('pendingApprovals', () =>
    supabase.from('tool_approvals').select('*').eq('status', 'pending'));
  await safeQuery('alerts', () =>
    supabase.from('notifications').select('*').eq('is_read', false).limit(20));

  return context;
};

// ---------- Agentic loop ----------

const extractText = (contentBlocks) =>
  contentBlocks
    .filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim();

// Run one full agent conversation turn: user message -> (tool use loop) -> final reply.
// Returns { reply, toolCalls, usage }.
const runAgentTurn = async ({ projectId, userMessage, conversationHistory = [], userId = null }) => {
  const client = getAnthropicClient();
  const context = await loadProjectContext(projectId);
  const system = buildSystemPrompt(context);
  const tools = registry.getToolDefinitions();

  const messages = [
    ...conversationHistory,
    { role: 'user', content: userMessage },
  ];

  const toolCalls = [];
  const usage = { input_tokens: 0, output_tokens: 0 };
  let reply = '';

  for (let turn = 0; turn < MAX_TURNS; turn += 1) {
    // eslint-disable-next-line no-await-in-loop
    const response = await client.messages.create({
      model: getModel(),
      max_tokens: MAX_TOKENS,
      system,
      tools,
      messages,
    });

    if (response.usage) {
      usage.input_tokens += response.usage.input_tokens || 0;
      usage.output_tokens += response.usage.output_tokens || 0;
    }

    const content = response.content || [];
    messages.push({ role: 'assistant', content });

    const toolUseBlocks = content.filter((block) => block.type === 'tool_use');

    if (response.stop_reason !== 'tool_use' || toolUseBlocks.length === 0) {
      reply = extractText(content);
      break;
    }

    // Execute every requested tool and feed results back in one user message.
    const toolResults = [];
    for (const block of toolUseBlocks) {
      const tool = registry.getTool(block.name);
      let result;
      if (!tool) {
        result = registry.toolError('UNKNOWN_TOOL', `No tool named "${block.name}" is available.`);
      } else {
        // eslint-disable-next-line no-await-in-loop
        result = await tool.execute(block.input, { project_id: projectId, user_id: userId });
      }

      toolCalls.push({ name: block.name, input: block.input, result });

      const isError = Boolean(result && result.error);
      toolResults.push({
        type: 'tool_result',
        tool_use_id: block.id,
        content: JSON.stringify(result),
        ...(isError ? { is_error: true } : {}),
      });
    }

    messages.push({ role: 'user', content: toolResults });

    // Loop cap reached without an end_turn — surface whatever text we have.
    if (turn === MAX_TURNS - 1) {
      reply = extractText(content)
        || 'Reached the maximum number of tool-use steps for this turn. Please continue the conversation to proceed.';
    }
  }

  return { reply, toolCalls, usage };
};

module.exports = {
  runAgentTurn,
  loadProjectContext,
  buildSystemPrompt,
  setAnthropicClient,
  setSupabaseClient,
  MAX_TURNS,
};
