import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import type { SearchVM } from '../../viewmodels/tiles/useSearchVM';
import { PillToggle } from '../ui/PillToggle';
import { PickerSelect } from '../ui/PickerSelect';
import { SearchBox } from './SearchBox';
import { ShareMenu } from './ShareMenu';

export function TopBar({ vm, search }: { vm: TopBarVM; search: SearchVM }) {
  const { t } = useTranslation();
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
