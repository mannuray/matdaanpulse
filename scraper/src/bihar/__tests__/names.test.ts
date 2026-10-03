// scraper/src/bihar/__tests__/names.test.ts
import { describe, it, expect } from 'vitest';
import { splitAcName, stripSerial, displayName, sexOf, isoDate, similarity } from '../names';

describe('names', () => {
  it('splits reservation markers, including the doubled 2015 form', () => {
    expect(splitAcName('RAMNAGAR (SC)')).toEqual({ name: 'RAMNAGAR', type: 'SC' });
    expect(splitAcName('Ramnagar (SC) (SC)')).toEqual({ name: 'Ramnagar', type: 'SC' });
    expect(splitAcName('Valmikinagar')).toEqual({ name: 'Valmikinagar', type: null });
  });
  it('strips the serial number in front of a candidate name', () => {
    expect(stripSerial('1 Dhirendra Pratap Singh alias Rinku singh')).toEqual({ serial: 1, name: 'Dhirendra Pratap Singh alias Rinku singh' });
    expect(stripSerial('  12 NOTA ')).toEqual({ serial: 12, name: 'NOTA' });
  });
  it('title-cases all-caps names and keeps mixed case', () => {
    expect(displayName('RAJESH  SINGH')).toBe('Rajesh Singh');
    expect(displayName('MD. KAMRAN')).toBe('Md. Kamran');
    expect(displayName('DHIRENDRA PRATAP SINGH ALIAS RINKU SINGH')).toBe('Dhirendra Pratap Singh Alias Rinku Singh');
    expect(displayName('Dhirendra Pratap Singh alias Rinku singh')).toBe('Dhirendra Pratap Singh alias Rinku singh');
  });
  it('reads sex in all ECI spellings', () => {
    expect(sexOf('MALE')).toBe('M'); expect(sexOf(' F ')).toBe('F'); expect(sexOf('THIRD GENDER')).toBe('O');
    expect(sexOf('TG')).toBe('O'); expect(sexOf('')).toBeNull(); expect(sexOf(null)).toBeNull();
  });
  it('normalises poll dates', () => {
    expect(isoDate('2020-11-07')).toBe('2020-11-07');
    expect(isoDate('28-Oct-2010')).toBe('2010-10-28');
    expect(isoDate('1-Nov-2015')).toBe('2015-11-01');
    expect(() => isoDate('soon')).toThrow();
  });
  it('scores name similarity', () => {
    expect(similarity('Rajesh Singh', 'RAJESH SINGH')).toBe(1);
    expect(similarity('Mukesh Kumar Kushwaha', 'Mukesh Kushwaha')).toBeGreaterThan(0.6);
    expect(similarity('Rajesh Singh', 'Bhagirathi Devi')).toBeLessThan(0.3);
  });
});
