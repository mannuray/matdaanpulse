import { useTranslation } from 'react-i18next';
import type { PartyStateView } from '../../../viewmodels/pages/usePartyPageVM';
import { heading, tile } from './ui';

/** Seats won per region at the latest election; hidden where the state has no regions. */
export function RegionsCard({ sv, color }: { sv: PartyStateView; color: string }) {
  const { t } = useTranslation();
  if (!sv.regions?.length) return null;
  return (
    <section id="pty-regions" className={`${tile} scroll-mt-28 p-4`} aria-label={t('pty_regions')}>
      <h2 className={`${heading} mb-3`}>{t('pty_regions')}</h2>
      <ul className="m-0 flex list-none flex-col gap-2 p-0">
        {sv.regions.map(r => (
          <li key={r.region} className="text-sm">
            <div className="flex justify-between"><span className="text-ink">{r.region}</span><span className="tabular text-muted">{t('pty_seats_of', { won: r.won, seats: r.seats })}</span></div>
            <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${r.seats ? (r.won / r.seats) * 100 : 0}%`, background: color }} /></span>
          </li>
        ))}
      </ul>
    </section>
  );
}
