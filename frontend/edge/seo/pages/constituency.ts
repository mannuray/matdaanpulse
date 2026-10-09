import { houseShown } from '../../../src/model/config/houses';
import { isNota } from '../../../src/model/derive/partyMeta';
import { partyPageHref } from '../../../src/model/derive/partyRecord';
import { isUncontested } from '../../../src/model/derive/uncontested';
import type { CandidateResult } from '../../../src/model/types';
import type { SeoApi } from '../api';
import { breadcrumbs, esc, houseWord, int, link, pct, seatLabel, shell, table } from '../html';
import { DEFAULT_OG_IMAGE } from '../site';
import { ttlFor, type SeoPage } from '../types';
import { notFoundPage } from './simple';

const SUFFIX = ' | MatdaanPulse';
const partyLabel = (c: CandidateResult): string => c.party?.abbreviation || c.party?.id || 'IND';

export async function constituencyPage(api: SeoApi, electionId: string, constId: string): Promise<SeoPage> {
  const [e, c, analysis] = await Promise.all([api.election(electionId), api.constituency(electionId, constId), api.seatAnalysis(electionId, constId)]);
  if (!houseShown(e.type)) return notFoundPage();

  const all = [...(c.candidates ?? [])].sort((a, b) => b.votes - a.votes);
  /** NOTA is a row in the table, never a person or a contender. */
  const cands = all.filter(x => !isNota(x.party?.id, x.name));
  const unopposed = isUncontested(all.map(x => ({ party_id: x.party?.id ?? null, votes: x.votes, status: x.status })));
  const totalVotes = all.reduce((s, x) => s + x.votes, 0);
  /** The seat detail may omit vote_share; derive it from the votes. */
  const share = (x: CandidateResult): number | null => x.vote_share ?? (totalVotes > 0 ? (x.votes / totalVotes) * 100 : null);
  const seat = seatLabel(c);
  const house = houseWord(e.type);
  const [top, second] = cands;
  const counted = !!top && top.votes > 0;
  const won = unopposed || (counted && (top.status === 'WON' || (e.status === 'Finalized' && top.status !== 'LEADING')));
  const leads = counted && !won && top.status === 'LEADING';
  const margin = top ? (top.margin > 0 ? top.margin : top.votes - (second?.votes ?? 0)) : 0;
  const round = c.current_round && c.total_rounds ? ` after round ${c.current_round} of ${c.total_rounds}` : '';

  const sentence = unopposed ? `${top.name} (${partyLabel(top)}) won ${seat} unopposed in ${e.year}.`
    : won && !second ? `${top.name} (${partyLabel(top)}) won ${seat} in ${e.year} with ${int(top.votes)} votes.`
    : won ? `${top.name} (${partyLabel(top)}) won ${seat} in ${e.year} by ${int(margin)} votes over ${second.name} (${partyLabel(second)}).`
    : leads ? `Counting: ${top.name} (${partyLabel(top)}) leads in ${seat} by ${int(margin)} votes${round}.`
    : `${seat} ${house} constituency, ${e.name}: ${cands.length} candidate${cands.length === 1 ? '' : 's'}.`;
  const title = won ? `${seat} ${house} Election Result ${e.year} — Winner, Margin & Votes${SUFFIX}`
    : leads ? `${seat} Live Result ${e.year} — ${top.name} leads${SUFFIX}`
    : `${seat} ${house} Election ${e.year} — Candidates${SUFFIX}`;
  const description = counted && !unopposed ? `${sentence} All ${cands.length} candidates with votes and vote share.` : sentence;

  const rows = all.map(x => [
    link(x.person_id && !isNota(x.party?.id, x.name) ? `/person/${x.person_id}` : null, x.name),
    link(partyPageHref(x.party?.id), partyLabel(x)),
    int(x.votes),
    pct(share(x)),
  ]);
  // The analysis history includes the current election itself.
  const history = (analysis?.data?.history ?? []).filter(h => h.year < e.year);
  const historyHtml = history.length
    ? `<h2>Earlier results</h2><ul>${history.map(h => `<li>${h.year}: ${link(h.person_id ? `/person/${h.person_id}` : null, h.candidate)} (${esc(h.party ?? 'IND')})</li>`).join('')}</ul>`
    : '';
  const path = `/election/${e.id}/constituency/${c.id}`;

  return {
    status: 200, title, description, path, ogType: 'website', image: DEFAULT_OG_IMAGE,
    jsonLd: [breadcrumbs([{ name: 'Home', path: '/' }, { name: e.name, path: `/election/${e.id}` }, { name: seat, path }])],
    body: shell(
      `<h1>${esc(seat)} — ${esc(e.name)}</h1><p>${esc(sentence)}</p><p>${link(`/election/${e.id}`, e.name)}</p>` +
      table(['Candidate', 'Party', 'Votes', 'Vote share'], rows) + historyHtml,
    ),
    noindex: false, ttl: ttlFor(e.status),
  };
}
