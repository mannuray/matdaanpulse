import { describe, it, expect } from 'vitest';
import { partyMark, buildPartyMeta, isNota } from '../partyMeta';

describe('partyMark', () => {
  it('prefers the logo, then the ECI symbol, then nothing', () => {
    expect(partyMark({ symbol_url: '/l.svg', eci_symbol_url: '/e.svg' })).toBe('/l.svg');
    expect(partyMark({ symbol_url: null, eci_symbol_url: '/e.svg' })).toBe('/e.svg');
    expect(partyMark({ symbol_url: '  ', eci_symbol_url: '' })).toBeNull();
    expect(partyMark(null)).toBeNull();
  });
});

describe('buildPartyMeta', () => {
  it('keys parties by id with abbreviation, mark and recognition', () => {
    const m = buildPartyMeta([{ id: 'BJP', name: 'Bharatiya Janata Party', color: '#f80', abbreviation: 'BJP', symbol_url: null, eci_symbol_url: '/e/BJP.svg', eci_recognition: 'National' }]);
    expect(m.get('BJP')).toEqual({ id: 'BJP', name: 'Bharatiya Janata Party', abbreviation: 'BJP', color: '#f80', mark: '/e/BJP.svg', eciRecognition: 'National' });
  });
});

describe('isNota', () => {
  it('matches the NOTA party id or name only', () => {
    expect(isNota('NOTA')).toBe(true);
    expect(isNota(null, 'nota')).toBe(true);
    expect(isNota(null, 'Independent')).toBe(false);
    expect(isNota('IND')).toBe(false);
  });
});
