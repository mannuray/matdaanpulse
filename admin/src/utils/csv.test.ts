import { describe, it, expect } from 'vitest';
import { auditCsv, csvField, toCsv } from './csv';
import type { AuditLog } from '../types';

describe('csvField', () => {
  it.each([
    ['plain', '"plain"'],
    ['a "quoted" word', '"a ""quoted"" word"'],
    ['one, two', '"one, two"'],
    ['line1\nline2', '"line1\nline2"'],
    [null, '""'],
    [undefined, '""'],
    [42, '"42"'],
    [{ votes: 5 }, '"{""votes"":5}"'],
    ['=HYPERLINK("http://x")', '"\'=HYPERLINK(""http://x"")"'],
    ['+91 98765', '"\'+91 98765"'],
    ['@sum', '"\'@sum"'],
    ['-12', '"-12"'],
  ])('%j → %s', (value, expected) => expect(csvField(value)).toBe(expected));
});

describe('toCsv and auditCsv', () => {
  it('joins with commas and CRLF line ends', () => {
    expect(toCsv(['A', 'B'], [[1, 'x,y']])).toBe('"A","B"\r\n"1","x,y"\r\n');
  });

  it('one row per entry with the admin, IST and UTC time, labels and the before/after JSON', () => {
    const logs: AuditLog[] = [{
      id: 'l1', user_id: null, users: null, action: 'RESULT_OVERRIDE', entity_type: 'result', entity_id: 'r1',
      old_value: { votes: 60000, status: 'TRAILING' }, new_value: { votes: 61204, status: 'LEADING' }, timestamp: '2026-10-01T08:00:00.000Z',
    }];
    const [header, row] = auditCsv(logs).split('\r\n');
    expect(header).toBe('"Time (IST)","Time (UTC)","Admin","Admin email","Action","Entity type","Entity ID","Before","After"');
    expect(row).toBe('"01 Oct 2026, 13:30","2026-10-01T08:00:00.000Z","Deleted user","","Result override","Result","r1",'
      + '"{""votes"":60000,""status"":""TRAILING""}","{""votes"":61204,""status"":""LEADING""}"');
  });
});
