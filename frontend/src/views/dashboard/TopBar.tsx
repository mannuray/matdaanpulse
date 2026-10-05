import { useMemo, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';
import { PillToggle } from '../ui/PillToggle';
import { PickerSelect } from '../ui/PickerSelect';
import { BottomSheet } from '../ui/BottomSheet';
import { SearchBox } from './SearchBox';
import { ShareMenu } from './ShareMenu';
import { Wordmark } from '../ui/Wordmark';
import { ElectionChoicesList, ElectionPickerPopover } from './ElectionPicker';

const ICON_BTN = 'grid h-11 w-11 shrink-0 place-items-center rounded-full text-muted hover:bg-tile-raised hover:text-ink focus-visible:ring-2 focus-visible:ring-accent';

function ThemeIcon({ theme }: { theme: 'dark' | 'light' }) {
  return theme === 'dark'
    ? <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden><circle cx="10" cy="10" r="3.6" /><path d="M10 2.5v2M10 15.5v2M2.5 10h2M15.5 10h2M4.7 4.7l1.4 1.4M13.9 13.9l1.4 1.4M4.7 15.3l1.4-1.4M13.9 6.1l1.4-1.4" /></svg>
    : <svg viewBox="0 0 20 20" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" aria-hidden><path d="M16.5 11.6A6.6 6.6 0 0 1 8.4 3.5a6.6 6.6 0 1 0 8.1 8.1z" /></svg>;
}

/** Carries the current path so feedback sent from About says which screen it is about. */
function AboutLink({ large = false }: { large?: boolean }) {
  const { t } = useTranslation();
  const { pathname } = useLocation();
  return (
    <Link to="/about" state={{ from: pathname }} data-about-link
      className={large
        ? 'flex min-h-11 items-center rounded-xl border border-line px-4 text-sm font-medium text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent'
        : 'flex h-9 shrink-0 items-center rounded-full border border-line px-3 text-sm text-muted hover:border-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-accent'}>
      {t('about_link')}
    </Link>
  );
}

function ElectionPickers({ vm, onDone }: { vm: TopBarVM; onDone(): void }) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3 pt-2">
      {vm.houses.length > 1 && <PillToggle value={vm.electionType} onChange={ty => { vm.onType(ty); onDone(); }} ariaLabel={t('studio_election_type')} size="lg" options={[{ value: 'LS', label: t('lok_sabha') }, { value: 'VS', label: t('vidhan_sabha') }]} />}
      {vm.electionType === 'VS' ? (
        <ElectionChoicesList vm={vm} onPicked={onDone} />
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
  const sheetSearch = useMemo<SearchVM>(() => ({ ...search, onPick: id => { search.onPick(id); setSheet(null); } }), [search]);
  return (
    <header className="flex h-[54px] min-w-0 items-center gap-1 rounded-tile border border-line bg-tile pl-3 pr-1">
      <Link to="/" className="flex h-11 min-w-0 shrink items-center gap-2 font-display text-base font-bold text-ink max-[369px]:hidden"><img src="/logo-mark.png" alt="" aria-hidden className="h-8 w-8 shrink-0 object-contain" /><Wordmark className="truncate" /></Link>
      <Link to="/" aria-label={t('app_title')} data-logo-mark className="hidden h-11 w-11 shrink-0 place-items-center max-[369px]:grid">
        <img src="/logo-mark.png" alt="" aria-hidden className="h-8 w-8 object-contain" />
      </Link>
      <button type="button" onClick={() => setSheet('election')} aria-label={t('studio_election_picker_current', { label: vm.electionLabel })} data-election-chip
        className="ml-auto flex h-11 min-w-0 max-w-[70%] shrink items-center gap-1 rounded-full border border-line bg-page/60 px-2.5 text-sm font-medium text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
        <span className="min-w-0 truncate">{vm.electionLabel}</span><span aria-hidden className="shrink-0 text-muted">▾</span>
      </button>
      <button type="button" onClick={() => setSheet('search')} aria-label={t('studio_search_open')} className={ICON_BTN}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden><circle cx="9" cy="9" r="5.5" /><path d="M13.2 13.2L17 17" /></svg>
      </button>
      <button type="button" onClick={() => setSheet('more')} aria-label={t('studio_more')} className={ICON_BTN}>
        <svg viewBox="0 0 20 20" className="h-5 w-5" fill="currentColor" aria-hidden><circle cx="4" cy="10" r="1.6" /><circle cx="10" cy="10" r="1.6" /><circle cx="16" cy="10" r="1.6" /></svg>
      </button>

      <BottomSheet open={sheet === 'election'} onOpenChange={onOpenChange('election')} title={t('studio_election_picker')} initialFocus="[data-current-election]">
        <ElectionPickers vm={vm} onDone={() => setSheet(null)} />
      </BottomSheet>
      <BottomSheet open={sheet === 'search'} onOpenChange={onOpenChange('search')} title={t('studio_search_open')} side="top" initialFocus="input[type=search]">
        <SearchBox vm={sheetSearch} inline className="mt-2" />
      </BottomSheet>
      <BottomSheet open={sheet === 'more'} onOpenChange={onOpenChange('more')} title={t('studio_more')}>
        <div className="flex flex-col gap-3 pt-2">
          <ShareMenu text={vm.shareText} large />
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm font-medium text-ink">{t('studio_theme')}</span>
            <PillToggle value={vm.theme} onChange={vm.onTheme} ariaLabel={t('studio_theme')} size="lg" options={[{ value: 'dark', label: t('studio_theme_dark') }, { value: 'light', label: t('studio_theme_light') }]} />
          </div>
          <PickerSelect size="lg" value={vm.lang} onChange={vm.onLang} ariaLabel={t('studio_language')} options={vm.langs.map(l => ({ value: l, label: l.toUpperCase() }))} />
          <AboutLink large />
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
      <Link to="/" className="flex shrink-0 items-center gap-2 font-display text-lg font-bold text-ink"><img src="/logo-mark.png" alt="" aria-hidden className="h-7 w-7 object-contain" /><Wordmark /></Link>
      {vm.houses.length > 1 && <PillToggle value={vm.electionType} onChange={vm.onType} ariaLabel={t('studio_election_type')} size="sm" options={[{ value: 'LS', label: t('lok_sabha') }, { value: 'VS', label: t('vidhan_sabha') }]} />}
      {vm.electionType === 'VS' ? (
        <ElectionPickerPopover vm={vm} />
      ) : (
        <PickerSelect value={vm.electionId} onChange={vm.onElection} ariaLabel={t('select_election')} options={vm.lsElections.map(e => ({ value: e.id, label: e.name }))} />
      )}
      <SearchBox vm={search} />
      <span className="ml-auto hidden shrink-0 items-center gap-2 rounded-full border border-line px-3 py-1 text-xs xl:inline-flex">
        <span className={s.kind === 'live' ? 'h-2 w-2 animate-pulse rounded-full bg-live' : 'h-2 w-2 rounded-full bg-ok'} />
        {t(`studio_status_label_${s.kind}`, { declared: s.declared, total: s.total })}
      </span>
      <AboutLink />
      <ShareMenu text={vm.shareText} />
      <button type="button" onClick={vm.onToggleTheme} aria-label={t(vm.theme === 'dark' ? 'studio_theme_to_light' : 'studio_theme_to_dark')}
        className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-line text-muted hover:border-accent hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"><ThemeIcon theme={vm.theme} /></button>
      <PickerSelect value={vm.lang} onChange={vm.onLang} ariaLabel={t('studio_language')} options={vm.langs.map(l => ({ value: l, label: l.toUpperCase() }))} />
    </header>
  );
}
