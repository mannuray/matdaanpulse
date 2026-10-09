import { describe, it, expect } from 'vitest';
import { makeGet, seoApi } from '../api';
import { constituencyPage } from '../pages/constituency';
import { BASE, apiFrom, constituency, election, lsElection, seatAnalysis, E_ID, LS_ID, P_ID } from './fixtures';

const api = (routes: Record<string, unknown>) => seoApi(makeGet(BASE, apiFrom(routes), new AbortController().signal));
const routes = {
  [`/elections/${E_ID}`]: election,
  [`/elections/${E_ID}/constituencies/BR-123`]: constituency,
  [`/elections/${E_ID}/constituencies/BR-123/analysis`]: seatAnalysis,
};

describe('constituencyPage', () => {
  it('finished seat: winner sentence, candidates table, earlier results, breadcrumbs', async () => {
    const p = await constituencyPage(api(routes), E_ID, 'BR-123');
    expect(p.title).toBe('Hajipur Assembly Election Result 2025 — Winner, Margin & Votes | MatdaanPulse');
    expect(p.description).toBe('Awadhesh Singh (BJP) won Hajipur in 2025 by 2,340 votes over Dev Kumar Chaurasia (RJD). All 2 candidates with votes and vote share.');
    expect(p.path).toBe(`/election/${E_ID}/constituency/BR-123`);
    expect(p.body.indexOf('Awadhesh Singh')).toBeLessThan(p.body.indexOf('Dev Kumar Chaurasia'));
    expect(p.body).toContain(`<a href="/person/${P_ID}">Awadhesh Singh</a>`);
    expect(p.body).toContain('<a href="/party/BJP">BJP</a>');
    expect(p.body).toContain('90,000');
    expect(p.body).toContain('48.4%');
    expect(p.body).toContain('Earlier results');
    expect(p.body).toContain(`2020: <a href="/person/${P_ID}">Awadhesh Singh</a> (BJP)`);
    expect(p.body).toContain(`<a href="/election/${E_ID}">Bihar Vidhan Sabha 2025</a>`);
    expect(p.jsonLd[0]).toMatchObject({ '@type': 'BreadcrumbList' });
    expect(p.ttl).toBe(86_400);
  });

  it('counting seat: leads wording with the round, 60 s TTL', async () => {
    const live = { ...election, status: 'Live' };
    const c = { ...constituency, current_round: 12, total_rounds: 30, candidates: constituency.candidates.map(x => ({ ...x, status: x.id === 'c1' ? 'LEADING' : 'TRAILING' })) };
    const p = await constituencyPage(api({ ...routes, [`/elections/${E_ID}`]: live, [`/elections/${E_ID}/constituencies/BR-123`]: c }), E_ID, 'BR-123');
    expect(p.title).toBe('Hajipur Live Result 2025 — Awadhesh Singh leads | MatdaanPulse');
    expect(p.description.startsWith('Counting: Awadhesh Singh (BJP) leads in Hajipur by 2,340 votes after round 12 of 30.')).toBe(true);
    expect(p.ttl).toBe(60);
  });

  it('seat with no votes yet does not claim a winner', async () => {
    const up = { ...election, status: 'Upcoming' };
    const c = { ...constituency, candidates: constituency.candidates.map(x => ({ ...x, votes: 0, vote_share: 0, status: null, margin: 0 })) };
    const p = await constituencyPage(api({ ...routes, [`/elections/${E_ID}`]: up, [`/elections/${E_ID}/constituencies/BR-123`]: c }), E_ID, 'BR-123');
    expect(p.title).toBe('Hajipur Assembly Election 2025 — Candidates | MatdaanPulse');
    expect(p.description).toBe('Hajipur Assembly constituency, Bihar Vidhan Sabha 2025: 2 candidates.');
    expect(p.description).not.toMatch(/won|leads/);
  });

  it('unopposed winner', async () => {
    const c = { ...constituency, candidates: [constituency.candidates[1]] };
    const p = await constituencyPage(api({ ...routes, [`/elections/${E_ID}/constituencies/BR-123`]: c }), E_ID, 'BR-123');
    expect(p.description.startsWith('Awadhesh Singh (BJP) won Hajipur unopposed in 2025.')).toBe(true);
  });

  it('works without seat analysis', async () => {
    const { [`/elections/${E_ID}/constituencies/BR-123/analysis`]: _, ...rest } = routes;
    const p = await constituencyPage(api(rest), E_ID, 'BR-123');
    expect(p.status).toBe(200);
    expect(p.body).not.toContain('Earlier results');
  });

  it('hidden house is a 404', async () => {
    const p = await constituencyPage(api({ [`/elections/${LS_ID}`]: lsElection, [`/elections/${LS_ID}/constituencies/BR-123`]: constituency }), LS_ID, 'BR-123');
    expect(p.status).toBe(404);
  });
});
