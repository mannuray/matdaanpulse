import { describe, it, expect } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { parseWinners, matchWinners, emitAffidavitsSeed, decodeScriptedRows } from '../affidavits';

const HTML = `<table><tr><th>Sno</th><th>Candidate</th><th>Constituency ∇</th><th>Party</th><th>Criminal Case</th><th>Education</th><th>Total Assets</th><th>Liabilities</th></tr>
<tr><td>1</td><td><a href="candidate.php?candidate_id=9784">Manoj Manzil</a></td><td>AGIAON (SC)</td><td>CPI(ML)(L)</td><td>30</td><td>Graduate</td><td>Rs&nbsp;3,16,500 ~ 3&nbsp;Lacs+</td><td>Rs&nbsp;0 ~</td></tr>
<tr><td>2</td><td><a href="candidate.php?candidate_id=12606">Narendra Narayan Yadav</a></td><td>ALAMNAGAR</td><td>JD(U)</td><td>1</td><td>Graduate</td><td>Rs&nbsp;2,01,83,564 ~ 2&nbsp;Crore+</td><td>Rs&nbsp;84,303 ~ 84&nbsp;Thou+</td></tr></table>`;
const SRC = 'https://myneta.info/bihar2020/index.php?action=show_winners&sort=default';

describe('affidavits', () => {
  it('parses the winners table', () => {
    expect(parseWinners(HTML, SRC)).toEqual([
      { name: 'Manoj Manzil', constituency: 'AGIAON (SC)', party: 'CPI(ML)(L)', criminalCases: 30, education: 'Graduate', assets: 316500, liabilities: 0, sourceUrl: 'https://myneta.info/bihar2020/candidate.php?candidate_id=9784' },
      { name: 'Narendra Narayan Yadav', constituency: 'ALAMNAGAR', party: 'JD(U)', criminalCases: 1, education: 'Graduate', assets: 20183564, liabilities: 84303, sourceUrl: 'https://myneta.info/bihar2020/candidate.php?candidate_id=12606' },
    ]);
  });
  it('matches by seat name and winner name, and reports the rest', () => {
    const seats = [
      { constNo: 195, name: 'Agiaon', winner: { candidateId: 'c195', name: 'Manoj Manjil' } },
      { constNo: 70, name: 'Alamnagar', winner: { candidateId: 'c70', name: 'Someone Else Entirely' } },
    ];
    const r = matchWinners(parseWinners(HTML, SRC), seats);
    expect(r.matched).toEqual([{ candidateId: 'c195', constNo: 195, criminalCases: 30, assets: 316500, liabilities: 0, education: 'Graduate', source: 'https://myneta.info/bihar2020/candidate.php?candidate_id=9784' }]);
    expect(r.unmatched).toEqual(['ALAMNAGAR: Narendra Narayan Yadav (winner in our data: Someone Else Entirely)']);
  });
  it('emits a run-once fill-only seed', () => {
    const sql = emitAffidavitsSeed({ 2020: [{ candidateId: '11111111-1111-1111-1111-111111111111', constNo: 195, criminalCases: 30, assets: 316500, liabilities: 0, education: 'Graduate', source: 's' }] });
    expect(sql).toContain("NOT EXISTS (SELECT 1 FROM seed_runs WHERE name = 'seed_bihar_affidavits')");
    expect(sql).toContain('assets = COALESCE(c.assets, v.assets::bigint)');
    expect(sql).toContain("('11111111-1111-1111-1111-111111111111', 30, 316500, 0, 'Graduate')");
    expect(sql).toContain('education = COALESCE(p.education, v.education)');
  });

  const row = (constituency: string, name: string) => ({ name, constituency, party: 'X', criminalCases: 0, education: null, assets: 1, liabilities: 0, sourceUrl: 's' });
  it('picks between seats that share a name by the winner\'s name', () => {
    const seats = [
      { constNo: 17, name: 'Pipra', winner: { candidateId: 'c17', name: 'Shyambabu Prasad Yadav' } },
      { constNo: 42, name: 'Pipra', winner: { candidateId: 'c42', name: 'Rambilash Kamat' } },
    ];
    const r = matchWinners([row('PIPRA', 'Shyambabu Prasad Yadav'), row('PIPRA', 'Rambilash Kamat')], seats);
    expect(r.matched.map(m => m.candidateId)).toEqual(['c17', 'c42']);
    expect(r.unmatched).toEqual([]);
  });
  it('ignores district tags and small spelling differences in the seat name', () => {
    const seats = [{ constNo: 128, name: 'Raghopur', winner: { candidateId: 'c128', name: 'Tejashwi Prasad Yadav' } }, { constNo: 183, name: 'Kumhrar', winner: { candidateId: 'c183', name: 'Arun Kumar Sinha' } }];
    const r = matchWinners([row('RAGHOPUR ( VAISHALI )', 'Tejashwi Prasad Yadav'), row('KUMHRARH', 'Arun Kumar Sinha')], seats);
    expect(r.matched.map(m => m.candidateId)).toEqual(['c128', 'c183']);
  });
  it('skips by-election winners without reporting them', () => {
    const seats = [{ constNo: 1, name: 'Belhar', winner: { candidateId: 'c1', name: 'Giridhari Yadav' } }];
    const r = matchWinners([row('BELHAR : BYE ELECTION ON 21-10-2019', 'Ramdeo Yadav')], seats);
    expect(r).toEqual({ matched: [], unmatched: [] });
  });
});

describe('emitAffidavitsSeed for another state', () => {
  it('names the seed and the elections', () => {
    const sql = emitAffidavitsSeed({}, { seedName: 'seed_kl_affidavits', label: 'Kerala VS 2026' });
    expect(sql).toContain("seed_runs WHERE name = 'seed_kl_affidavits'");
    expect(sql).toContain("Kerala VS 2026 winners'");
    expect(sql).not.toMatch(/Bihar/);
  });
});

describe('MyNeta rows hidden in obfuscated scripts (2026 pages)', () => {
  const html = fs.readFileSync(path.join(__dirname, 'fixtures/myneta-assam2026-winners.htm'), 'utf8');
  it('reads the scripted rows too (Assam 2026: 112 plain + 14 scripted = 126 winners)', () => {
    const rows = parseWinners(html, 'https://myneta.info/assam2026/');
    expect(rows).toHaveLength(126);
    expect(new Set(rows.map(r => r.constituency)).size).toBe(126);
  });
  it('leaves a page without scripts unchanged', () => {
    expect(decodeScriptedRows('<table><tr><td>a</td></tr></table>')).toBe('<table><tr><td>a</td></tr></table>');
  });
});

describe('matchWinners with spelling variants of the seat name', () => {
  const row = (constituency: string, name: string) => ({ name, constituency, party: 'AITC', criminalCases: 0, education: null, assets: null, liabilities: null, sourceUrl: 'u' });
  const seats = [{ constNo: 287, name: 'Labpur', winner: { candidateId: 'c287', name: 'Debasis Ojha' } }, { constNo: 1, name: 'Mekliganj', winner: { candidateId: 'c1', name: 'Paresh Adhikary' } }];
  it('falls back to a close seat name whose winner has the same name (LABHPUR = Labpur)', () => {
    expect(matchWinners([row('LABHPUR', 'Debasis Ojha (Haku Da)')], seats).matched.map(m => m.candidateId)).toEqual(['c287']);
  });
  it('ignores bracketed nicknames on both sides', () => {
    const s2 = [{ ...seats[0], winner: { candidateId: 'c287', name: 'Debasis Ojha (haku Da)' } }];
    expect(matchWinners([row('LABHPUR', 'Debasis Ojha')], s2).matched).toHaveLength(1);
  });
  it('still reports a variant whose winner name does not match', () => {
    expect(matchWinners([row('LABHPUR', 'Somebody Else')], seats).unmatched).toHaveLength(1);
  });
});
