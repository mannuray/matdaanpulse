import { describe, it, expect } from 'vitest';
import { renderGovernmentSeed, validate } from '../government-cli';

describe('government seed', () => {
  const rows = [{ state: 'BR', year: 2025, parties: ['BJP', 'JDU'], label: 'NDA', source: 'https://x' }];
  it('renders a fill-only update of the published manifest and a pending draft', () => {
    const sql = renderGovernmentSeed(rows);
    expect(sql).toContain(`('BR', 2025, '{"parties":["BJP","JDU"],"label":"NDA","source":"https://x"}'::jsonb)`);
    expect(sql).toContain(`NOT (e.manifest_url::jsonb ? 'government')`);
    expect(sql).toContain(`NOT (e.manifest_draft ? 'government')`);
    expect(sql).not.toMatch(/TRUNCATE|DELETE/i);
  });
  it('rejects duplicates, empty parties and a missing source', () => {
    expect(() => validate([...rows, ...rows])).toThrow(/duplicate BR 2025/);
    expect(() => validate([{ ...rows[0], parties: [] }])).toThrow(/no parties/);
    expect(() => validate([{ ...rows[0], source: '' }])).toThrow(/no source/);
  });
});
