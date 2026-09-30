import { describe, it, expect } from 'vitest';
import { calculatePartySwitches } from '../intelligence';
import type { ResultRow } from '../../types';

const r = (const_id: string, candidate_name: string, party_id: string): ResultRow => ({ const_id, party_id, candidate_name, votes: 100, status: 'WON', margin: 5 });

describe('calculatePartySwitches', () => {
  const els = [
    { year: 2010, results: [r('BR_VS10_7_ALPHA', 'Ram Kumar', 'JDU'), r('BR_VS10_8_BETA', 'Shyam Lal', 'RJD')] },
    { year: 2015, results: [r('BR_VS15_7_ALPHA', 'Ram Kumar', 'BJP'), r('BR_VS15_8_BETA', 'Shyam Lal', 'RJD')] },
    { year: 2020, results: [r('BR_VS20_7_ALPHA', 'Ram Kumar', 'BJP'), r('BR_VS20_8_BETA', 'Shyam Lal', 'JDU')] },
  ];
  const current = new Map([['BR:7', 'BR_VS_7_ALPHA'], ['BR:8', 'BR_VS_8_BETA']]);

  it('maps an older pair\'s switcher to the current election\'s seat id', () => {
    const e = calculatePartySwitches(els, current).find(x => x.toYear === 2015)!;
    expect(e).toMatchObject({ constId: 'BR_VS_7_ALPHA', fromParty: 'JDU', toParty: 'BJP' });
  });
  it('maps the latest pair too, and falls back to the election\'s own id when the seat is unknown', () => {
    const latest = calculatePartySwitches(els, current).find(x => x.toYear === 2020)!;
    expect(latest.constId).toBe('BR_VS_8_BETA');
    expect(calculatePartySwitches(els, new Map()).find(x => x.toYear === 2020)!.constId).toBe('BR_VS20_8_BETA');
  });
  it('lists the newest switches first', () => {
    expect(calculatePartySwitches(els, current).map(x => x.toYear)).toEqual([2020, 2015]);
  });
});
