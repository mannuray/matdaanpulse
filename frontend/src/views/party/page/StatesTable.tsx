import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { StateRowView } from '../../../viewmodels/pages/usePartyPageVM';
import { Avatar } from '../../ui/Avatar';
import { DeltaCell } from './Delta';
import { Sparkline } from './Sparkline';
import { fmtShare, heading, tile } from './ui';

function Bar({ won, contested, color }: { won: number; contested: number; color: string }) {
  return <span className="block h-1.5 w-24 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${contested ? Math.min(100, (won / contested) * 100) : 0}%`, background: color }} /></span>;
}

/** Every contested state at its latest election (table on desktop, stacked rows on phones); a row opens the state view. */
export function StatesTable({ states, color }: { states: StateRowView[]; color: string }) {
  const { t } = useTranslation();
  if (!states.length) return null;
  const seats = t('pty_seats_short'), pts = t('pty_pts');
  return (
    <section className={`${tile} p-4`} aria-label={t('pty_states_title')}>
      <h2 className={`${heading} mb-3`}>{t('pty_states_title')}</h2>
      <table className="w-full text-sm max-lg:hidden">
        <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
          <th className="py-2 font-semibold">{t('pty_state')}</th><th className="font-semibold">{t('pty_latest')}</th><th className="font-semibold">{t('pty_won_contested')}</th>
          <th className="font-semibold">{t('pty_vote_share')}</th><th className="font-semibold">{t('pty_change')}</th><th className="font-semibold">{t('pty_trend')}</th><th className="font-semibold">{t('pty_president')}</th>
        </tr></thead>
        <tbody>
          {states.map(s => (
            <tr key={s.code} className="border-b border-line/60 hover:bg-tile-raised">
              <td className="py-2.5"><Link to={s.href} className="font-semibold text-ink hover:underline">{s.name}</Link></td>
              <td className="tabular text-muted">{s.year}</td>
              <td><div className="flex flex-col gap-1"><span className="tabular"><strong className="text-ink">{s.won}</strong> <span className="text-muted">/ {s.contested}</span></span><Bar won={s.won} contested={s.contested} color={color} /></div></td>
              <td className="tabular text-ink">{fmtShare(s.share)}</td>
              <td><DeltaCell delta={s.delta} seatsLabel={seats} ptsLabel={pts} /></td>
              <td><Sparkline values={s.spark} color={color} /></td>
              <td>{s.president ? <span className="inline-flex items-center gap-2"><Avatar name={s.president.name} photo={s.president.photo} size={24} /><span className="text-ink">{s.president.name}</span></span> : null}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <ul className="m-0 flex list-none flex-col gap-2 p-0 lg:hidden">
        {states.map(s => (
          <li key={s.code}>
            <Link to={s.href} className="block rounded-xl border border-line bg-page/50 p-3 hover:border-accent">
              <div className="flex items-baseline justify-between"><span className="font-semibold text-ink">{s.name} <span className="text-xs font-normal text-muted">· {s.year}</span></span><span aria-hidden className="text-muted">›</span></div>
              <div className="mt-1 flex items-center justify-between gap-2 text-sm">
                <span className="tabular"><strong className="text-ink">{s.won}</strong> <span className="text-muted">/ {s.contested} {seats}</span></span>
                <span className="tabular text-ink">{fmtShare(s.share)}</span>
                <DeltaCell delta={s.delta} seatsLabel={seats} ptsLabel={pts} />
              </div>
              <div className="mt-1"><Bar won={s.won} contested={s.contested} color={color} /></div>
              <div className="mt-2 flex items-center justify-between"><Sparkline values={s.spark} color={color} />{s.president && <span className="text-xs text-muted">{s.president.name}</span>}</div>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
