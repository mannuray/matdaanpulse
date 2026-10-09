import { partyPageHref } from '../../../src/model/derive/partyRecord';
import type { SeoApi } from '../api';
import { breadcrumbs, esc, int, link, pct, shell, table, abs } from '../html';
import { DEFAULT_OG_IMAGE } from '../site';
import { TTL, type SeoPage } from '../types';
import { notFoundPage } from './simple';

export async function partyPage(api: SeoApi, id: string, state: string | null): Promise<SeoPage> {
  if (!partyPageHref(id)) return notFoundPage();
  const [party, record] = await Promise.all([api.party(id), api.partyRecord(id, state)]);
  // The record covers finished shown-house (VS) elections only: a Lok Sabha-only party has no page.
  if (record.elections.length === 0 && !(record.family_elections?.length)) return notFoundPage();
  const stateRows = state ? record.elections.filter(r => r.state_code === state) : [];
  // A state the party never contested is not its own page: fall back to the national view and canonical.
  const view = stateRows.length ? state : null;
  const rows = view ? stateRows : record.elections;
  const path = partyPageHref(id, view)!;
  const label = party.abbreviation && party.abbreviation !== party.name ? `${party.name} (${party.abbreviation})` : party.name;
  const where = view ? ` in ${rows[0].state_name}` : '';
  const description = rows.length
    ? `${label}: ${rows.slice(0, 3).map(r => `won ${r.won} of ${r.seats_total} seats in ${r.state_name} ${r.year}`).join('; ')}.`
    : `${label}: party profile and election record on MatdaanPulse.`;
  const tableRows = rows.map(r => [
    link(`/election/${r.election_id}`, `${r.state_name} ${r.year}`), int(r.contested), `${int(r.won)} / ${int(r.seats_total)}`, pct(r.share),
  ]);
  const sameAs = [party.wikipedia_url, party.website].filter((u): u is string => !!u);
  return {
    status: 200, title: `${label}${where} — Election Results & Seat History | MatdaanPulse`, description, path,
    ogType: 'website', image: DEFAULT_OG_IMAGE,
    jsonLd: [
      {
        '@context': 'https://schema.org', '@type': 'Organization', name: party.name, url: abs(path),
        ...(party.abbreviation ? { alternateName: party.abbreviation } : {}),
        ...(party.founded_year ? { foundingDate: String(party.founded_year) } : {}),
        ...(sameAs.length ? { sameAs } : {}),
      },
      breadcrumbs([{ name: 'Home', path: '/' }, { name: party.name, path }]),
    ],
    body: shell(
      `<h1>${esc(label + where)}</h1><p>${esc(description)}</p>` + (party.description ? `<p>${esc(party.description)}</p>` : '') +
      (tableRows.length ? table(['Election', 'Contested', 'Won', 'Vote share'], tableRows) : ''),
    ),
    noindex: false, ttl: TTL.normal,
  };
}
