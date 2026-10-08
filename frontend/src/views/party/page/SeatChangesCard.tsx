import { useTranslation } from 'react-i18next';
import type { PartyStateView } from '../../../viewmodels/pages/usePartyPageVM';
import { heading, tile } from './ui';

function Bars({ title, rows, color, nameOf }: { title: string; rows: { party: string; seats: number; split: boolean }[]; color: string; nameOf(id: string): string }) {
  const { t } = useTranslation();
  if (!rows.length) return null;
  const max = Math.max(...rows.map(r => r.seats), 1);
  return (
    <div className="mt-3">
      <p className="mb-1 text-[11px] uppercase tracking-wider text-muted">{title}</p>
      <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
        {rows.map(r => (
          <li key={r.party + r.split} className="text-sm">
            <div className="flex justify-between"><span className="text-ink">{nameOf(r.party)}{r.split && <span className="ml-2 rounded border border-line px-1 text-[10px] text-muted">{t('pty_split')}</span>}</span><span className="tabular text-muted">{r.seats}</span></div>
            <span className="mt-0.5 block h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${(r.seats / max) * 100}%`, background: color }} /></span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Held / gained / lost at the latest election, with whom; split moves are tagged, not flips. */
export function SeatChangesCard({ sv, nameOf }: { sv: PartyStateView; nameOf(id: string): string }) {
  const { t } = useTranslation();
  const c = sv.changes;
  return (
    <section id="pty-changes" className={`${tile} scroll-mt-28 p-4`} aria-label={t('pty_changes_at', { year: sv.year })}>
      <h2 className={`${heading} mb-3`}>{t('pty_changes_at', { year: sv.year })}</h2>
      {!c ? <p className="text-sm text-muted">{t('pty_first_on_boundaries')}</p> : (
        <>
          <div className="grid grid-cols-3 gap-2 text-center">
            {([['pty_held', c.held, 'text-ink'], ['pty_gained', c.gained, 'text-ok-text'], ['pty_lost', c.lost, 'text-live-text']] as const).map(([k, n, cls]) => (
              <div key={k} className="rounded-xl border border-line bg-page/50 py-2"><p className="text-[11px] uppercase tracking-wider text-muted">{t(k)}</p><p className={`tabular font-display text-2xl font-bold ${cls}`}>{n}</p></div>
            ))}
          </div>
          <Bars title={t('pty_gained_from')} rows={c.gainedFrom} color="var(--color-ok-text)" nameOf={nameOf} />
          <Bars title={t('pty_lost_to')} rows={c.lostTo} color="var(--color-live-text)" nameOf={nameOf} />
        </>
      )}
    </section>
  );
}
