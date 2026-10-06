import { describe, it, expect } from 'vitest';
import { sliceSeats } from '../seat-range';
import type { RawElection, RawSeat, SeatSummary } from '../types';

const seat = (constNo: number): RawSeat => ({ constNo, acName: `S${constNo}`, type: null, electors: 100, nota: null, totalVotes: 10,
  candidates: [{ serial: 1, name: 'A', sex: null, age: null, party: 'X', general: 10, postal: 0, total: 10 }] });
const summary = (constNo: number) => ({ constNo, name: `S${constNo}` }) as SeatSummary;

describe('sliceSeats', () => {
  it("keeps a report's seats in the range and renumbers them (Andhra in the undivided 2009/2014 reports)", () => {
    const raw = { year: 2014, seats: [119, 120, 121, 294].map(seat), summaries: [119, 120, 121, 294].map(summary), parties: [], performance: [] } as RawElection;
    const out = sliceSeats(raw, { from: 120, to: 294, offset: 119 });
    expect(out.seats.map(s => [s.constNo, s.acName])).toEqual([[1, 'S120'], [2, 'S121'], [175, 'S294']]);
    expect(out.summaries.map(s => [s.constNo, s.name])).toEqual([[1, 'S120'], [2, 'S121'], [175, 'S294']]);
  });
});
