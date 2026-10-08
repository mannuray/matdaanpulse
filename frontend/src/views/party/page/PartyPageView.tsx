import { useTranslation } from 'react-i18next';
import type { PartyPageVM } from '../../../viewmodels/pages/usePartyPageVM';
import { PageShell } from '../../page/PageShell';
import { PartyHeader } from './PartyHeader';
import { HeadlineStrip } from './HeadlineStrip';
import { StateChips } from './StateChips';
import { StatesTable } from './StatesTable';
import { LineageCard } from './LineageCard';
import { AboutCard } from './AboutCard';
import { JumpLinks } from './JumpLinks';
import { UnitCard } from './UnitCard';
import { RecordCard } from './RecordCard';
import { SeatChangesCard } from './SeatChangesCard';
import { MlasCard } from './MlasCard';
import { RegionsCard } from './RegionsCard';
import { fmtShare, heading, signed, tile } from './ui';

/** The party page (spec docs/superpowers/specs/2026-10-08-party-page-design.md): national view, or one state's view. */
export function PartyPageView({ vm }: { vm: PartyPageVM }) {
  const { t } = useTranslation();
  const back = { href: '/', label: t('back') };
  if (vm.status !== 'ready' || !vm.party) {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('pty_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const p = vm.party;
  const sv = vm.view === 'state' ? vm.stateView : null;
  if (sv) {
    const aside = (
      <div className="shrink-0 text-left md:text-right">
        <p className="text-[11px] uppercase tracking-wider text-muted">{sv.name} · {sv.year}</p>
        <p className="tabular font-display text-3xl font-bold" style={{ color: vm.color }}>{t('pty_seats_of', { won: sv.won, seats: sv.seatsTotal })}</p>
        <p className="tabular text-xs text-muted">{t('pty_vote_share')} {fmtShare(sv.share)}{sv.delta ? ` (${signed(sv.delta.share, 1)} ${t('pty_pts')})` : ''}</p>
      </div>
    );
    return (
      <PageShell back={back}>
        <PartyHeader vm={vm} recognition={sv.recognition ? t(`party_recognition_${sv.recognition}`) : null}
          leader={sv.president ? { label: t('pty_state_president'), name: sv.president.name } : null}
          extra={sv.office ? <span key="o">{t('pty_office')} <strong className="font-semibold text-ink">{sv.office}</strong></span> : null} aside={aside} />
        <StateChips chips={vm.chips} />
        <JumpLinks sections={sv.sections} />
        {/* Desktop: two columns. Phones: one column, the column wrappers dissolve (contents) and order sets the sequence. */}
        <div className="flex flex-col gap-3 lg:grid lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
          <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
            <div className="max-lg:order-2"><RecordCard sv={sv} color={vm.color} nameOf={vm.nameOf} /></div>
            <section id="pty-map" className={`${tile} scroll-mt-28 p-4 max-lg:order-3`} aria-label={t('pty_map')}><h2 className={heading}>{t('pty_map')}</h2></section>
            <div className="max-lg:order-5"><MlasCard sv={sv} /></div>
          </div>
          <div className="max-lg:contents lg:flex lg:min-w-0 lg:flex-col lg:gap-3">
            <div className="max-lg:order-1"><UnitCard sv={sv} /></div>
            <div className="max-lg:order-4"><SeatChangesCard sv={sv} nameOf={vm.nameOf} /></div>
            <div className="max-lg:order-6"><RegionsCard sv={sv} color={vm.color} /></div>
          </div>
        </div>
      </PageShell>
    );
  }
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
