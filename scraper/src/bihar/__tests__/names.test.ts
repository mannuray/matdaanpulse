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
  it('drops the "Father\'s Name" disambiguation ECI appends to some names', () => {
    expect(displayName("Dr. Sunil Kumar Father's Name :-Bhagwat Prasad")).toBe('Dr. Sunil Kumar');
    expect(displayName('Sunil Kumar Father’s Name :- Shyamnandan Prasad')).toBe('Sunil Kumar');
  });
  it('reads sex in all ECI spellings', () => {
    expect(sexOf('MALE')).toBe('M'); expect(sexOf(' F ')).toBe('F'); expect(sexOf('THIRD GENDER')).toBe('O');
    expect(sexOf('TG')).toBe('O'); expect(sexOf('')).toBeNull(); expect(sexOf(null)).toBeNull();
  });
  it('normalises poll dates', () => {
    expect(isoDate('2020-11-07')).toBe('2020-11-07');
    expect(isoDate('28-Oct-2010')).toBe('2010-10-28');
    expect(isoDate('08/02/2020')).toBe('2020-02-08');
    expect(isoDate('1-Nov-2015')).toBe('2015-11-01');
    expect(() => isoDate('soon')).toThrow();
  });
  it('scores name similarity', () => {
    expect(similarity('Rajesh Singh', 'RAJESH SINGH')).toBe(1);
    expect(similarity('Mukesh Kumar Kushwaha', 'Mukesh Kushwaha')).toBeGreaterThan(0.6);
    expect(similarity('Rajesh Singh', 'Bhagirathi Devi')).toBeLessThan(0.3);
  });
});

describe('splitAcName with a dotted reservation suffix', () => {
  it('reads "S.C" / "S.C." / "S.T." as the seat type (UP 2017: "Mahadewa S.C", "Machhlishahr S.C.")', () => {
    expect(splitAcName('Mahadewa S.C')).toEqual({ name: 'Mahadewa', type: 'SC' });
    expect(splitAcName('Machhlishahr S.C.')).toEqual({ name: 'Machhlishahr', type: 'SC' });
    expect(splitAcName('Obra S.T.')).toEqual({ name: 'Obra', type: 'ST' });
    expect(splitAcName('Sasaram')).toEqual({ name: 'Sasaram', type: null });
  });
});

describe('splitAcName with dotted brackets and a seat-number prefix (UP/UK 2017 summaries)', () => {
  it('reads "(S.C.)" / "(s.c.)" / "(S.T.)" as the seat type', () => {
    expect(splitAcName('Balha (S.C.)')).toEqual({ name: 'Balha', type: 'SC' });
    expect(splitAcName('Someshwar (s.c.)')).toEqual({ name: 'Someshwar', type: 'SC' });
    expect(splitAcName('Duddhi (S.T.)')).toEqual({ name: 'Duddhi', type: 'ST' });
  });
  it('drops a leading "175-" seat number', () => {
    expect(splitAcName('175-Lucknow Cantt.')).toEqual({ name: 'Lucknow Cantt.', type: null });
    expect(splitAcName('12 - Pernem')).toEqual({ name: 'Pernem', type: null });
  });
  it('reads Sikkim\'s (BL) as ST, in each file\'s spelling', () => {
    expect(splitAcName('6- Daramdin(BL)')).toEqual({ name: 'Daramdin', type: 'ST' });
    expect(splitAcName('1-YUKSOM-TASHIDING-(BL)')).toEqual({ name: 'YUKSOM-TASHIDING', type: 'ST' });
    expect(splitAcName('Yoksam-tashiding (BL)-ST')).toEqual({ name: 'Yoksam-tashiding', type: 'ST' });
    expect(splitAcName('Sangha-GEN')).toEqual({ name: 'Sangha', type: 'GEN' });
    expect(splitAcName('Kabi Lungchuk (BL)')).toEqual({ name: 'Kabi Lungchuk', type: 'ST' });
    expect(splitAcName('NAMCHI-SINGHITHANG')).toEqual({ name: 'NAMCHI-SINGHITHANG', type: null });
  });
});
