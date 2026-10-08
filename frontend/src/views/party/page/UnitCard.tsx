import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PartyStateView, RoleView } from '../../../viewmodels/pages/usePartyPageVM';
import { Avatar } from '../../ui/Avatar';
import { heading, tile } from './ui';

function Holder({ label, r }: { label: string; r: RoleView }) {
  const { t } = useTranslation();
  const name = r.personId ? <Link to={`/person/${r.personId}`} className="font-semibold text-ink hover:underline">{r.name}</Link> : <span className="font-semibold text-ink">{r.name}</span>;
  return (
    <div className="flex items-center gap-3 rounded-xl border border-line bg-page/50 p-3">
      <Avatar name={r.name} photo={r.photo} size={40} />
      <div className="min-w-0"><p className="text-[11px] uppercase tracking-wider text-muted">{label}</p>{name}{r.since && <p className="text-xs text-muted">{t('pty_since', { date: r.since.slice(0, 4) })}</p>}</div>
    </div>
  );
}

/** The state unit: current president and legislature leader, then past presidents. Hidden when nothing is known. */
export function UnitCard({ sv }: { sv: PartyStateView }) {
  const { t } = useTranslation();
  if (!sv.president && !sv.leader && !sv.pastPresidents.length) return null;
  return (
    <section id="pty-unit" className={`${tile} p-4`} aria-label={t('pty_unit')}>
      <h2 className={`${heading} mb-3`}>{t('pty_unit')}</h2>
      <div className="flex flex-col gap-2">
        {sv.president && <Holder label={t('pty_state_president')} r={sv.president} />}
        {sv.leader && <Holder label={t('pty_legislature_leader')} r={sv.leader} />}
      </div>
      {sv.pastPresidents.length > 0 && (
        <>
          <p className="mb-1 mt-3 text-[11px] uppercase tracking-wider text-muted">{t('pty_past_presidents')}</p>
          <ul className="m-0 list-none divide-y divide-line p-0 text-sm">
            {sv.pastPresidents.map((p, i) => <li key={i} className="flex justify-between py-1.5"><span className="text-ink">{p.name}</span><span className="tabular text-muted">{[p.from?.slice(0, 4), p.to?.slice(0, 4)].filter(Boolean).join('–')}</span></li>)}
          </ul>
        </>
      )}
    </section>
  );
}
