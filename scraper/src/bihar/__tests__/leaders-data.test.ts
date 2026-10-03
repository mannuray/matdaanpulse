import { describe, it, expect } from 'vitest';
import { validateLeaders, type LeadersFile } from '../leaders-data';

const base = (): LeadersFile => ({
  people: [{ key: 'nitish-kumar', name: 'Nitish Kumar', wikidata: 'Q1', candidacies: [] }, { key: 'tejashwi-yadav', name: 'Tejashwi Yadav', wikidata: 'Q2', candidacies: [{ year: 2015, const_id: 'BR_VS15_128_RAGHOPUR' }] }],
  elections: {
    '2010': { leaders: [{ key: 'nitish-kumar', role: 'Chief Minister', party_id: 'JDU' }], cabinet: [], sources: ['https://en.wikipedia.org/wiki/X'] },
    '2015': { leaders: [{ key: 'tejashwi-yadav', role: 'Deputy Chief Minister', party_id: 'RJD' }], cabinet: [], sources: ['https://en.wikipedia.org/wiki/Y'] },
    '2020': { leaders: [], cabinet: [], sources: ['s'] }, '2025': { leaders: [], cabinet: [], sources: ['s'] },
  },
});
const seats = { '2015': new Set(['BR_VS15_128_RAGHOPUR']), '2010': new Set<string>(), '2020': new Set<string>(), '2025': new Set<string>() };

describe('validateLeaders', () => {
  it('accepts a consistent file', () => { expect(validateLeaders(base(), seats)).toEqual([]); });
  it('reports unknown keys, unknown seats, missing sources and duplicates', () => {
    const f = base();
    f.elections['2010'].cabinet.push({ key: 'nobody', role: 'Minister', party_id: 'JDU' });
    f.people[1].candidacies.push({ year: 2020, const_id: 'BR_VS20_999_X' });
    f.elections['2020'].sources = [];
    f.people.push({ ...f.people[0] });
    expect(validateLeaders(f, seats)).toEqual(expect.arrayContaining([
      expect.stringMatching(/unknown person "nobody"/), expect.stringMatching(/BR_VS20_999_X/), expect.stringMatching(/2020: no sources/), expect.stringMatching(/duplicate key "nitish-kumar"/),
    ]));
  });
});
