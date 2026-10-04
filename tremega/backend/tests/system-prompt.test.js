// tests/system-prompt.test.js
const { buildSystemPrompt } = require('../src/prompts/system');

describe('buildSystemPrompt', () => {
  test('includes GC CORE, ELECTRICAL, and GUARDRAILS sections', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('GC CORE');
    expect(prompt).toContain('ELECTRICAL');
    expect(prompt).toContain('GUARDRAILS');
  });

  test('includes NEC citation and guardrail language', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toMatch(/NEC \d/);
    expect(prompt).toMatch(/cite code references/i);
    expect(prompt).toMatch(/never fabricate/i);
    expect(prompt).toMatch(/human/i);
  });

  test('injects provided context into CURRENT PROJECT STATE', () => {
    const prompt = buildSystemPrompt({
      openBids: [{ id: 'b1', title: 'Panel upgrade' }],
      team: [{ name: 'Mike', role: 'journeyman' }],
    });
    expect(prompt).toContain('CURRENT PROJECT STATE');
    expect(prompt).toContain('Panel upgrade');
    expect(prompt).toContain('Mike');
    expect(prompt).toContain('Open Bids');
    expect(prompt).toContain('Team');
    // Sections with no data should be omitted entirely
    expect(prompt).not.toContain('Active Phases');
  });

  test('tolerates undefined context', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('CURRENT PROJECT STATE');
    expect(prompt).toContain('No project data available');
  });

  test('tolerates empty/partial context', () => {
    const prompt = buildSystemPrompt({ openBids: [], alerts: null });
    expect(prompt).toContain('No project data available');
    expect(typeof prompt).toBe('string');
    expect(prompt.length).toBeGreaterThan(100);
  });
});
