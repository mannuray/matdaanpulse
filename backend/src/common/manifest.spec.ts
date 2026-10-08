import { Logger } from '@nestjs/common';
import { electionDate, manifestBits, parseManifest } from './manifest';

describe('parseManifest', () => {
  it('parses JSON text into an object', () => {
    expect(parseManifest('{"a":[1,2]}')).toEqual({ a: [1, 2] });
  });

  it('returns null for absent, empty, bad or non-object values without throwing', () => {
    for (const v of [null, undefined, '', '{not json', '"str"', '5', 'null', '[]', '[1,2]']) expect(parseManifest(v)).toBeNull();
  });

  it('logs bad JSON once per call', () => {
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      parseManifest('{oops');
      expect(warn).toHaveBeenCalledTimes(1);
    } finally {
      warn.mockRestore();
    }
  });
});

describe('manifestBits', () => {
  it('reads alliances, government, vote splits and leaders from manifest text; bad JSON = empty', () => {
    const m = manifestBits(JSON.stringify({ alliances: [{ id: 'NDA', parties: ['BJP'] }], government: { parties: ['BJP'], source: 'x' },
      vote_splits: [{ spoiler: 'BSP', hurts: 'MGB' }], leaders: [{ name: 'L', party_id: 'BJP' }], cabinet: [{ name: 'C', party_id: 'BJP', person_id: 'p9' }] }));
    expect(m.alliances).toEqual([{ id: 'NDA', parties: ['BJP'] }]);
    expect(m.government).toEqual(['BJP']);
    expect(m.voteSplits).toEqual([{ spoiler: 'BSP', hurts: 'MGB' }]);
    expect(m.heavyweights).toEqual([{ person_id: null, name: 'L', party_id: 'BJP', reason: 'leader' }, { person_id: 'p9', name: 'C', party_id: 'BJP', reason: 'cabinet' }]);
    const warn = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    try {
      expect(manifestBits('{oops')).toEqual({ alliances: [], government: null, voteSplits: [], heavyweights: [] });
    } finally {
      warn.mockRestore();
    }
    expect(manifestBits(null).government).toBeNull();
  });
});

describe('electionDate', () => {
  it('is the counting date as YYYY-MM-DD, else 1 July of the election year', () => {
    expect(electionDate(new Date('2025-11-14T00:00:00Z'), 2025)).toBe('2025-11-14');
    expect(electionDate(null, 2020)).toBe('2020-07-01');
    expect(electionDate(undefined, 2015)).toBe('2015-07-01');
  });
});
