import { useTranslation } from 'react-i18next';
import type { Headline } from '../../../viewmodels/pages/usePartyPageVM';
import { formatIN } from '../../ui/format';

function Cell({ label, value, sub }: { label: string; value: string; sub?: string | null }) {
  return (
    <div className="flex min-w-0 flex-col justify-center bg-tile px-4 py-3">
      <span className="text-[11px] uppercase tracking-wider text-muted">{label}</span>
      <span className="tabular font-display text-3xl font-bold text-ink">{value}</span>
      {sub && <span className="text-xs text-muted">{sub}</span>}
    </div>
  );
}

/** National headline at each state's latest election (the years differ, so the caption says so). */
export function HeadlineStrip({ h }: { h: Headline }) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
      <Cell label={t('pty_seats_held')} value={formatIN(h.won)} sub={`${t('pty_of_seats', { seats: formatIN(h.seats) })} · ${t('pty_latest_caption')}`} />
      <Cell label={t('pty_states')} value={String(h.statesWon)} sub={t('pty_contested_in', { n: h.statesContested })} />
      <Cell label={t('pty_governs')} value={h.governs == null ? '—' : String(h.governs)} sub={h.governs == null ? t('pty_not_recorded') : t('pty_states_word')} />
      <Cell label={t('pty_largest_in')} value={String(h.largest)} sub={t('pty_states_word')} />
    </div>
  );
}
