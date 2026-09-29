import { parseConstituencyEnrichment, buildConstituencyPrompt } from './constituency-enrichment.strategy';

describe('constituency enrichment parsing', () => {
  const payload = {
    briefing: 'A close contest decided by rural turnout.',
    demographics: { population: 1800000, literacy_pct: 71.2 },
    key_issues: ['Floods', 'Jobs', ' '],
    tags: ['Rural', 'swing-seat'],
  };

  it('parses a ```json fenced response', () => {
    const text = 'Here is the analysis:\n```json\n' + JSON.stringify(payload, null, 2) + '\n```\nHope this helps.';
    const out = parseConstituencyEnrichment(text);
    expect(out.briefing).toBe(payload.briefing);
    expect(out.demographics).toEqual(payload.demographics);
    expect(out.key_issues).toEqual(['Floods', 'Jobs']);
    expect(out.tags).toEqual(['rural', 'swing-seat']);
  });

  it('parses a bare JSON object surrounded by prose', () => {
    const out = parseConstituencyEnrichment(`Sure. ${JSON.stringify(payload)} Done.`);
    expect(out.briefing).toBe(payload.briefing);
  });

  it('coerces missing/invalid optional fields', () => {
    const out = parseConstituencyEnrichment(JSON.stringify({ briefing: 'x', demographics: 'n/a', key_issues: 'a, b' }));
    expect(out.demographics).toBeNull();
    expect(out.key_issues).toEqual(['a', 'b']);
    expect(out.tags).toEqual([]);
  });

  it('throws when there is no JSON or no briefing', () => {
    expect(() => parseConstituencyEnrichment('The seat is interesting.')).toThrow();
    expect(() => parseConstituencyEnrichment('{"summary": "wrong key"}')).toThrow(/briefing/);
    expect(() => parseConstituencyEnrichment('{not json}')).toThrow();
  });

  it('prompt asks for JSON with every key the parser reads', () => {
    const prompt = buildConstituencyPrompt('Patna Sahib', 'Lok Sabha 2024', 'post_poll', 'ctx');
    expect(prompt).toMatch(/JSON/);
    for (const key of ['briefing', 'demographics', 'key_issues', 'tags']) {
      expect(prompt).toContain(`"${key}"`);
    }
  });
});
