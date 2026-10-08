import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { geoMercator, geoPath } from 'd3';
import type { PartyMapVM } from '../../../viewmodels/pages/usePartyPageVM';
import { heading, tile } from './ui';

const W = 640, H = 460;

/** "Where it won": the picked election's own map, a fill per seat (won / lost / not contested); click opens the seat. */
export function PartyMapCard({ map, color }: { map: PartyMapVM | null; color: string }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const paths = useMemo(() => {
    if (!map || !map.features.length) return [];
    const fc = { type: 'FeatureCollection', features: map.features } as unknown as GeoJSON.FeatureCollection;
    const path = geoPath(geoMercator().fitExtent([[8, 8], [W - 8, H - 8]], fc));
    return map.features.map(f => ({ f, d: path(f as unknown as GeoJSON.Feature) ?? '', id: map.seatOf.get(f) ?? null }));
  }, [map]);
  const resultText = (r: string | undefined) => t(r === 'won' ? 'pty_map_won' : r === 'lost' ? 'pty_map_lost' : 'pty_map_none');
  return (
    <section id="pty-map" className={`${tile} scroll-mt-28 p-4`} aria-label={t('pty_map')}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <h2 className={heading}>{t('pty_map')}</h2>
        {map && map.years.length > 1 && (
          <select value={map.electionId} onChange={e => map.setElection(e.target.value)} aria-label={t('pty_year')} className="rounded-full border border-line bg-page px-3 py-1 text-sm text-ink">
            {map.years.map(y => <option key={y.electionId} value={y.electionId}>{y.year}</option>)}
          </select>
        )}
      </div>
      {!map || map.status === 'loading' ? <div className="h-64 animate-pulse rounded-xl bg-page" /> : map.status === 'error' || !paths.length ? (
        <p className="py-10 text-center text-sm text-muted">{t('pty_map_unavailable')}</p>
      ) : (
        <>
          <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" role="img" aria-label={t('pty_map')}>
            {paths.map(({ d, id }, i) => {
              const fill = id ? map.fills.get(id) : undefined;
              return (
                <path key={id ?? i} d={d} data-seat={id ?? undefined} fill={fill?.color ?? 'var(--color-map-pending)'} fillOpacity={fill?.opacity ?? 1}
                  stroke="var(--color-map-stroke)" strokeWidth={0.5} className={id ? 'cursor-pointer hover:stroke-[var(--color-ink)]' : undefined}
                  onClick={id ? () => navigate(`/election/${map.electionId}/constituency/${id}`) : undefined}>
                  {id && <title>{`${map.seatName(id)} · ${resultText(fill?.result)}`}</title>}
                </path>
              );
            })}
          </svg>
          <div className="mt-2 flex flex-wrap gap-4 text-xs text-muted">
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: color }} />{t('pty_map_won')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm opacity-25" style={{ background: color }} />{t('pty_map_lost')}</span>
            <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: 'var(--color-map-pending)' }} />{t('pty_map_none')}</span>
            <span className="ml-auto">{t('pty_map_click')}</span>
          </div>
        </>
      )}
    </section>
  );
}
