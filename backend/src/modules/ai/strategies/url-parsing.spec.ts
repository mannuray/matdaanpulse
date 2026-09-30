import { parsePartyEnrichment } from './party-enrichment.strategy';
import { parsePersonEnrichment } from './person-enrichment.strategy';
import { asHttpUrl } from './ai-response.parser';

describe('AI output URL fields (S-M2)', () => {
  it('asHttpUrl keeps http(s) and drops everything else', () => {
    expect(asHttpUrl(' https://en.wikipedia.org/wiki/X ')).toBe('https://en.wikipedia.org/wiki/X');
    expect(asHttpUrl('javascript:alert(1)')).toBeUndefined();
    expect(asHttpUrl('data:image/png;base64,xx')).toBeUndefined();
    expect(asHttpUrl('/relative')).toBeUndefined();
    expect(asHttpUrl(null)).toBeUndefined();
  });

  it('person parser drops non-http(s) photo/wikipedia URLs', () => {
    const r = parsePersonEnrichment(JSON.stringify({ bio: 'b', photo_url: 'javascript:alert(1)', wikipedia_url: 'https://en.wikipedia.org/wiki/A' }))!;
    expect(r.photo_url).toBeUndefined();
    expect(r.wikipedia_url).toBe('https://en.wikipedia.org/wiki/A');
  });

  it('party parser drops non-http(s) website/wikipedia URLs', () => {
    const r = parsePartyEnrichment(JSON.stringify({ website: 'ftp://x.org', wikipedia_url: 'JavaScript:alert(1)' }))!;
    expect(r.website).toBeUndefined();
    expect(r.wikipedia_url).toBeUndefined();
  });
});

import { geminiApiUrl, DEFAULT_GEMINI_MODEL } from '../ai-enrichment.service';

describe('GEMINI_MODEL', () => {
  it('uses the configured model id', () => {
    expect(geminiApiUrl('gemini-2.5-flash')).toBe('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent');
  });
  it('falls back to the default for missing or malformed ids', () => {
    expect(geminiApiUrl(undefined)).toContain(`/models/${DEFAULT_GEMINI_MODEL}:`);
    expect(geminiApiUrl('../../evil')).toContain(`/models/${DEFAULT_GEMINI_MODEL}:`);
  });
});
