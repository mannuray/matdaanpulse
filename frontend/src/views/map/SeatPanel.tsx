import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { SeatPanelVM } from '../../viewmodels/tiles/useSeatPanelVM';

export function SeatPanel({ vm }: { vm: SeatPanelVM | null }) {
  const { t } = useTranslation();
  if (!vm) return <aside className="rounded-tile border border-line bg-page/40 p-4 text-sm text-muted">{t('studio_pick_seat')}</aside>;
  const total = vm.candidates.reduce((s, c) => s + c.votes, 0) || 1;
  return (
    <aside className="flex min-h-0 flex-col gap-3 overflow-auto rounded-tile border border-line bg-page/40 p-4">
      <div className="flex items-center justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <h3 className="truncate font-display text-2xl font-bold uppercase text-ink">{vm.name}</h3>
          <button type="button" onClick={vm.onToggleTrack} aria-pressed={vm.tracked}
            className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-semibold text-muted hover:border-accent hover:text-ink aria-pressed:border-accent aria-pressed:text-accent">
            {vm.tracked ? t('studio_tracked') : t('studio_track')}
          </button>
        </div>
        <button type="button" onClick={vm.onClose} className="text-muted hover:text-ink" aria-label={t('studio_close')}>✕</button>
      </div>
      {vm.margin != null && <p className="text-sm text-muted">{t('studio_margin', { count: vm.margin })}</p>}
      {vm.history && <p className="text-sm text-muted">{t(`studio_chip_${vm.history.classification}`, vm.history.classification)}{vm.history.dominantParty ? ` · ${vm.history.dominantParty}` : ''}</p>}
      {vm.briefing && <p className="rounded-[0.5rem] border border-line bg-tile p-3 text-sm leading-relaxed text-ink">{vm.briefing}</p>}
      <ol className="flex flex-col gap-2">
        {vm.candidates.map(c => (
          <li key={`${c.name}-${c.partyId}`} className="rounded-[0.5rem] border border-line p-2">
            <div className="flex items-center gap-2 text-sm"><span className="h-2 w-2 rounded-full" style={{ background: c.color }} /><span className="flex-1 truncate font-semibold text-ink">{c.name}</span><span className="text-muted">{c.partyId}</span></div>
            <div className="mt-1 flex items-center gap-2"><span className="h-1.5 flex-1 overflow-hidden rounded-full bg-page"><span className="block h-full" style={{ width: `${(c.votes / total) * 100}%`, background: c.color }} /></span><span className="tabular text-xs text-muted">{c.votes.toLocaleString()}</span></div>
          </li>
        ))}
      </ol>
      <Link to={vm.fullPageHref} className="mt-auto text-sm font-semibold text-accent hover:underline">{t('view_full_page')} →</Link>
    </aside>
  );
}
