import { houseShown } from '../../../src/model/config/houses';
import { contestViews, personStats, type ContestStatus } from '../../../src/model/derive/personPage';
import type { SeoApi } from '../api';
import { abs, breadcrumbs, esc, int, link, shell, table } from '../html';
import { DEFAULT_OG_IMAGE } from '../site';
import { TTL, type SeoPage } from '../types';

const WORD: Record<ContestStatus, string> = { WON: 'won', LOST: 'lost', LEADING: 'leading', TRAILING: 'trailing', PENDING: 'contesting' };

export async function personPage(api: SeoApi, id: string): Promise<SeoPage> {
  const p = await api.person(id);
  const cands = p.candidates.filter(c => houseShown(c.election_type ?? 'VS'));
  const views = contestViews(cands);
  const stats = personStats(cands);
  const latest = views[0];
  const description = latest
    ? `${p.name}${latest.partyLabel ? ` (${latest.partyLabel})` : ''}: contested ${stats.contests} election${stats.contests === 1 ? '' : 's'}, won ${stats.wins}. ` +
      `Latest: ${latest.constituency}, ${latest.year} — ${WORD[latest.status]}.`
    : `${p.name}: election record on MatdaanPulse.`;
  const rows = views.map(v => [
    esc(v.year ?? ''), link(v.constHref, v.constituency), link(v.partyHref, v.partyLabel), esc(WORD[v.status]), int(v.votes),
  ]);
  const path = `/person/${p.id}`;
  const counting = views.some(v => v.status === 'LEADING' || v.status === 'TRAILING');
  return {
    status: 200, title: `${p.name} — Election History, Wins & Constituencies | MatdaanPulse`, description, path,
    ogType: 'profile', image: DEFAULT_OG_IMAGE,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Person', name: p.name, url: abs(path),
        ...(p.photo_url?.startsWith('https://') ? { image: p.photo_url } : {}),
        ...(latest?.partyName ? { affiliation: { '@type': 'Organization', name: latest.partyName } } : {}),
      },
      breadcrumbs([{ name: 'Home', path: '/' }, { name: p.name, path }]),
    ],
    body: shell(`<h1>${esc(p.name)}</h1><p>${esc(description)}</p>` + (rows.length ? table(['Year', 'Constituency', 'Party', 'Result', 'Votes'], rows) : '')),
    noindex: false, ttl: counting ? TTL.live : TTL.normal,
  };
}
