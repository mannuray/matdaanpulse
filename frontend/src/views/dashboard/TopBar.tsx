import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';
import { PillToggle } from '../ui/PillToggle';
import { PickerSelect } from '../ui/PickerSelect';
import { BottomSheet } from '../ui/BottomSheet';
import { SearchBox } from './SearchBox';
import { ShareMenu } from './ShareMenu';

const ICON_BTN = 'grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent';

function ElectionPickers({ vm, onDone }: { vm: TopBarVM; onDone(): void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 pt-2">
      <PillToggle value={vm.electionType} onChange={vm.onType} ariaLabel={t('studio_election_type')} size="lg" options={[{ value: 'LS', label: t('lok_sabha') }, { value: 'VS', label: t('vidhan_sabha') }]} />
      {vm.electionType === 'VS' ? (
        <div className="flex flex-wrap gap-2">
          <PickerSelect size="lg" value={String(vm.stateId ?? '')} onChange={v => vm.onState(Number(v))} ariaLabel={t('select_state')} placeholder={t('select_state')} options={vm.states.map(x => ({ value: String(x.id), label: x.name }))} />
          <PickerSelect size="lg" value={vm.electionId} onChange={id => { vm.onElection(id); onDone(); }} ariaLabel={t('studio_year')} options={vm.years.map(y => ({ value: y.id, label: String(y.year) }))} />
        </div>
      ) : (
        <PickerSelect size="lg" value={vm.electionId} onChange={id => { vm.onElection(id); onDone(); }} ariaLabel={t('select_election')} options={vm.lsElections.map(e => ({ value: e.id, label: e.name }))} />
      )}
    </div>
  );
}

/** Mobile top bar: one row (title, election chip, search, more), with the controls in sheets. */
function CompactTopBar({ vm, search }: { vm: TopBarVM; search: SearchVM }) {
  const { t } = useTranslation();
  const [sheet, setSheet] = useState<'election' | 'search' | 'more' | null>(null);
  const onOpenChange = (name: 'election' | 'search' | 'more') => (o: boolean) => setSheet(o ? name : null);
  const sheetSearch: SearchVM = { ...search, onPick: id => { search.onPick(id); setSheet(null); } };
  return (
    <header className="flex h-[54px] min-w-0 items-center gap-1 rounded-tile border border-line bg-tile pl-3 pr-1">
      <Link to="/" className="min-w-0 shrink truncate font-display text-base font-bold text-ink">{t('app_title')}</Link>
      <button type="button" onClick={() => setSheet('election')} aria-label={`${t('studio_election_picker')}: ${vm.electionLabel}`} data-election-chip
        className="ml-auto flex h-11 shrink-0 items-center gap-1 rounded-full border border-line bg-page/60 px-2.5 text-sm font-medium text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
        <span className="truncate">{vm.electionLabel}</span><span aria-hidden className="text-muted">▾</span>
      </button>
      <button type="button" onClick={() => setSheet('search')} aria-label={t('studio_search_open')} className={ICON_BTN}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></svg>
      </button>
      <button type="button" onClick={() => setSheet('more')} aria-label={t('studio_more')} className={ICON_BTN}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg>
      </button>

      <BottomSheet open={sheet === 'election'} onOpenChange={onOpenChange('election')} title={t('studio_election_picker')}>
        <ElectionPickers vm={vm} onDone={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet open={sheet === 'search'} onOpenChange={onOpenChange('search')} title={t('studio_search_open')} side="top" initialFocus="input[type=search]">
        <SearchBox vm={sheetSearch} inline className="mt-2" />
      </BottomSheet>
      <BottomSheet open={sheet === 'more'} onOpenChange={onOpenChange('more')} title={t('studio_more')}>
        <div className="flex flex-col gap-3 pt-2">
          <ShareMenu text={vm.shareText} large />
          <PickerSelect size="lg" value={vm.lang} onChange={vm.onLang} ariaLabel={t('studio_language')} options={vm.langs.map(l => ({ value: l, label: l.toUpperCase() }))} />
        </div>
      </BottomSheet>
    </header>
  );
}

export function TopBar({ vm, search, compact = false }: { vm: TopBarVM; search: SearchVM; compact?: boolean }) {
  const { t } = useTranslation();
  if (compact) return <CompactTopBar vm={vm} search={search} />;
  const s = vm.statusLabel;
  return (
    <header className="flex h-12 min-w-0 items-center gap-3 rounded-tile border border-line bg-tile px-4">
      <Link to="/" className="shrink-0 font-display text-lg font-bold text-ink">{t('app_title')}</Link>
      <PillToggle value={vm.electionType} onChange={vm.onType} ariaLabel={t('studio_election_type')} size="sm" options={[{ value: 'LS', label: t('lok_sabha') }, { value: 'VS', label: t('vidhan_sabha') }]} />
      {vm.electionType === 'VS' ? (
        <>
          <PickerSelect value={String(vm.stateId ?? '')} onChange={v => vm.onState(Number(v))} ariaLabel={t('select_state')} placeholder={t('select_state')} options={vm.states.map(x => ({ value: String(x.id), label: x.name }))} />
          <PickerSelect value={vm.electionId} onChange={vm.onElection} ariaLabel={t('studio_year')} options={vm.years.map(y => ({ value: y.id, label: String(y.year) }))} />
        </>
      ) : (
        <PickerSelect value={vm.electionId} onChange={vm.onElection} ariaLabel={t('select_election')} options={vm.lsElections.map(e => ({ value: e.id, label: e.name }))} />
      )}
      <SearchBox vm={search} />
      <span className="ml-auto hidden shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1 text-xs xl:inline-flex">
        <span className={s.kind === 'live' ? 'h-2 w-2 animate-pulse rounded-full bg-live' : 'h-2 w-2 rounded-full bg-emerald-400'} />
        {t(`studio_status_label_${s.kind}`, { declared: s.declared, total: s.total })}
      </span>
      <ShareMenu text={vm.shareText} />
      <PickerSelect value={vm.lang} onChange={vm.onLang} ariaLabel={t('studio_language')} options={vm.langs.map(l => ({ value: l, label: l.toUpperCase() }))} />
    </header>
  );
}
