import { houseShown } from '../../../src/model/config/houses';
import type { Alliance, ManifestAlliance, ResultRow } from '../../../src/model/types';
import type { SeoApi } from '../api';
import { breadcrumbs, esc, int, link, shell, table } from '../html';
import { DEFAULT_OG_IMAGE } from '../site';
import { ttlFor, type SeoPage } from '../types';
import { notFoundPage } from './simple';

const SUFFIX = ' | MatdaanPulse';

/** Seats (won + leading) per alliance from the manifest; parties outside every alliance stand alone. Zero-seat groups dropped. */
export function groupTally(tally: Alliance[], alliances: ManifestAlliance[]): { name: string; seats: number }[] {
  const allianceOf = new Map<string, ManifestAlliance>();
  alliances.forEach(a => a.parties.forEach(p => allianceOf.set(p, a)));
  const sums = new Map<string, number>();
  for (const t of tally) {
    const name = allianceOf.get(t.party_id)?.name ?? t.party_id;
    sums.set(name, (sums.get(name) ?? 0) + t.won + t.leading);
  }
  return [...sums].map(([name, seats]) => ({ name, seats })).filter(g => g.seats > 0)
    .sort((a, b) => b.seats - a.seats || a.name.localeCompare(b.name));
}

/** Each seat's winner or current leader (highest-vote WON/LEADING row). */
function leaders(results: ResultRow[]): Map<string, ResultRow> {
  const out = new Map<string, ResultRow>();
  for (const r of results) {
    if (r.status !== 'WON' && r.status !== 'LEADING') continue;
    const cur = out.get(r.const_id);
    if (!cur || r.votes > cur.votes) out.set(r.const_id, r);
  }
  return out;
}

export async function electionPage(api: SeoApi, id: string): Promise<SeoPage> {
  const e = await api.election(id);
  if (!houseShown(e.type)) return notFoundPage();
  const [manifest, seats, liveState] = await Promise.all([api.manifest(id), api.constituencies(id), api.live(id)]);
  // While counting, read the versioned snapshot every viewer's dashboard reads (immutable, CDN-cached per version).
  const snap = liveState?.status === 'Live' ? await api.snapshot(id, liveState.version) : null;
  const [tally, results] = snap ? [snap.summary, snap.results] : await Promise.all([api.alliances(id), api.results(id)]);
  const groups = groupTally(tally, manifest?.draft?.alliances ?? []);
  const total = seats.length;
  const top2 = groups.slice(0, 2).map(g => `${g.name} ${g.seats}`).join(', ');
  const top4 = groups.slice(0, 4).map(g => `${g.name} ${g.seats}`).join(', ');
  const declared = results.filter(r => r.status === 'WON').length;
  const live = e.status === 'Live';
  const hasSeats = groups.length > 0;

  const title = !hasSeats ? `${e.name} — Constituencies & Candidates${SUFFIX}`
    : live ? `${e.name} Live Results — ${top2}${SUFFIX}`
    : `${e.name} Results — ${top2}${SUFFIX}`;
  const description = !hasSeats ? `${e.name}: all ${total} constituencies, candidates and past results.`
    : live ? `Counting live: ${top4} (won + leading) of ${total} seats; ${declared} declared. Constituency-wise live results.`
    : `${e.name}: ${top4} of ${total} seats. Party-wise tally, constituency map and the winner of every seat.`;

  const lead = leaders(results);
  const seatItems = [...seats].sort((a, b) => a.const_no - b.const_no).map(s => {
    const w = lead.get(s.id);
    const who = w ? ` — ${esc(w.candidate_name)} (${esc(w.party_id)})` : '';
    return `<li>${link(`/election/${e.id}/constituency/${s.id}`, `${s.const_no}. ${s.name}`)}${who}</li>`;
  }).join('');
  const tallyTable = hasSeats ? table(['Party / alliance', 'Seats'], groups.map(g => [esc(g.name), int(g.seats)])) : '';

  return {
    status: 200, title, description, path: `/election/${e.id}`, ogType: 'website', image: DEFAULT_OG_IMAGE,
    jsonLd: [breadcrumbs([{ name: 'Home', path: '/' }, { name: e.name, path: `/election/${e.id}` }])],
    body: shell(`<h1>${esc(e.name)}</h1><p>${esc(description)}</p>${tallyTable}<h2>Constituencies</h2><ul>${seatItems}</ul>`),
    noindex: false, ttl: ttlFor(e.status),
  };
}
