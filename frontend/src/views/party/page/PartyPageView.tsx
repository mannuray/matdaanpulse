import { useTranslation } from 'react-i18next';
import type { PartyPageVM } from '../../../viewmodels/pages/usePartyPageVM';
import { PageShell } from '../../page/PageShell';
import { PartyHeader } from './PartyHeader';
import { HeadlineStrip } from './HeadlineStrip';
import { StateChips } from './StateChips';
import { StatesTable } from './StatesTable';
import { LineageCard } from './LineageCard';
import { AboutCard } from './AboutCard';
import { tile } from './ui';

/** The party page (spec docs/superpowers/specs/2026-10-08-party-page-design.md): national view, or one state's view. */
export function PartyPageView({ vm }: { vm: PartyPageVM }) {
  const { t } = useTranslation();
  const back = { href: '/', label: t('back') };
  if (vm.status !== 'ready' || !vm.party) {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('pty_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const p = vm.party;
  const recognition = p.eci_recognition ? t(`party_recognition_${p.eci_recognition}`) : null;
  return (
    <PageShell back={back}>
      <PartyHeader vm={vm} recognition={recognition} leader={p.leader_name ? { label: t('pty_leader'), name: p.leader_name } : null} />
      <StateChips chips={vm.chips} />
      {vm.missingState && <p className="text-sm text-muted">{t('pty_missing_state', { party: p.abbreviation ?? p.name, state: vm.missingState })}</p>}
      {vm.recordError ? (
        <div className={`${tile} flex items-center justify-between p-4 text-sm text-muted`}>
          <span>{t('error_occurred')}</span>
          <button type="button" onClick={vm.retry} className="rounded-full border border-line px-4 py-1.5 text-ink hover:border-accent">{t('retry')}</button>
        </div>
      ) : vm.noResults ? (
        <p className={`${tile} p-4 text-sm text-muted`}>{t('pty_no_results')}</p>
      ) : (
        <>
          {vm.states.length > 0 && <HeadlineStrip h={vm.headline} />}
          <StatesTable states={vm.states} color={vm.color} />
        </>
      )}
      <div className="grid gap-3 lg:grid-cols-2">
        <LineageCard events={vm.lineage} nameOf={vm.nameOf} />
        <AboutCard description={p.description} />
      </div>
    </PageShell>
  );
}
