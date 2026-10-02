import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { ConstituencyPageVM } from '../../viewmodels/pages/useConstituencyPageVM';
import { PageShell } from '../page/PageShell';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN, formatRupees } from '../ui/format';
import { LiveChip } from '../seat/SeatDialog';
import { ShareMenu } from '../dashboard/ShareMenu';
import { LocatorMap } from './LocatorMap';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { cn } from '../ui/cn';

const tile = 'rounded-tile border border-line bg-tile p-4';
const h2 = 'mb-3 font-display text-sm font-bold uppercase tracking-wider text-ink';

export function ConstituencyPageView({ vm }: { vm: ConstituencyPageVM }) {
  const { t } = useTranslation();
  const back = { href: vm.electionHref, label: t('cp_back') };
  if (vm.status !== 'ready') {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('cp_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const [lead, second] = vm.view.candidates.filter(c => !c.nota);
  const facts = ([
    ['seat_electors', vm.facts.electors != null ? formatIN(vm.facts.electors) : null],
    ['cp_votes_polled', vm.facts.votesPolled != null ? formatIN(vm.facts.votesPolled) : null],
    ['seat_turnout', vm.facts.turnout != null ? `${vm.facts.turnout}%` : null],
    ['seat_phase', vm.facts.phase != null ? t('seat_phase_n', { n: vm.facts.phase }) : null],
    ['cp_region', vm.facts.region], ['cp_district', vm.facts.district],
  ] as const).filter(([, v]) => v);
  return (
    <PageShell back={back}>
      <nav className="text-xs uppercase tracking-wider text-muted">{[vm.electionName, vm.stateName, vm.districtName].filter(Boolean).join(' › ')}</nav>
      <div className="flex flex-wrap items-center gap-3 border-b border-line pb-3">
        <h1 className="font-display text-4xl font-bold uppercase lg:text-5xl">{vm.name}</h1>
        {(vm.constNo != null || vm.type) && <span className="rounded-md border border-line px-2 py-0.5 font-mono text-xs">{[vm.constNo != null && `No. ${vm.constNo}`, vm.type && vm.type !== 'GEN' && vm.type].filter(Boolean).join(' · ')}</span>}
        <LiveChip live={vm.live} />
        <div className="ml-auto flex items-center gap-2">
          <button type="button" onClick={vm.onToggleTrack} aria-pressed={vm.tracked} className="rounded-full bg-accent px-4 py-1.5 text-sm font-semibold text-white aria-pressed:bg-tile-raised aria-pressed:text-accent">{vm.tracked ? t('studio_tracked') : t('studio_track')}</button>
          <ShareMenu text={vm.shareText} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,0.8fr)]">
        {lead && (
          <section className={tile} aria-label={t('cp_head_to_head')}>
            <h2 className={h2}>{t('cp_head_to_head')}</h2>
            <div className="flex items-start justify-between gap-4">
              {[lead, second].filter(Boolean).map((c, i) => (
                <div key={c!.key} className={cn('flex items-center gap-3', i === 1 && 'flex-row-reverse text-right')}>
                  <Avatar name={c!.name} photo={c!.photo} size={72} />
                  <div>
                    {c!.pill && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c!.pill])}>{t(`studio_status_${c!.pill.toLowerCase()}`)}</span>}
                    <div className="text-lg font-semibold">{c!.name}</div>
                    {c!.partyId && <Link to={vm.partyHref(c!.partyId)} className={cn('flex items-center gap-1.5 text-sm text-muted hover:text-ink hover:underline', i === 1 && 'justify-end')}><PartyMark mark={c!.mark} color={c!.color} label={c!.partyLabel} />{c!.partyLabel}</Link>}
                    <div className="tabular font-display text-3xl font-bold">{formatIN(c!.votes)}</div>
                    <div className="text-sm" style={{ color: c!.color }}>{c!.share}%</div>
                  </div>
                </div>
              ))}
            </div>
            {vm.view.totalVotes > 0 && (
              <>
                <div className="mt-4 flex h-2.5 overflow-hidden rounded-full bg-page">
                  <span style={{ width: `${lead.share}%`, background: lead.color }} />
                  <span className="flex-1" />
                  {second && <span style={{ width: `${second.share}%`, background: second.color }} />}
                </div>
                {vm.view.margin != null && <p className="mt-2 text-right text-sm font-semibold text-ok-text">{t('seat_margin')} +{formatIN(vm.view.margin)}</p>}
              </>
            )}
          </section>
        )}
        {facts.length > 0 && (
          <section className={tile}>
            <h2 className={h2}>{t('cp_seat_facts')}</h2>
            <dl className="divide-y divide-line text-sm">{facts.map(([k, v]) => <div key={k} className="flex justify-between py-2"><dt className="text-muted">{t(k)}</dt><dd className="tabular font-semibold">{v}</dd></div>)}</dl>
            {vm.facts.progress && (
              <div className="mt-3"><div className="flex justify-between text-xs text-muted"><span>{t('cp_counting_progress')}</span><span>{vm.facts.progress.current}/{vm.facts.progress.total}</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-page"><span className="block h-full bg-accent" style={{ width: `${(vm.facts.progress.current / vm.facts.progress.total) * 100}%` }} /></div></div>
            )}
          </section>
        )}
        {vm.locator && (
          <section className={tile}><h2 className={h2}>{t('cp_locator')}</h2><LocatorMap features={vm.locator.features} seat={vm.locator.seat} label={vm.name} /></section>
        )}
      </div>

      <section className={cn(tile, 'overflow-x-auto p-0')}>
        <h2 className={cn(h2, 'px-4 pt-4')}>{t('cp_all_candidates')}</h2>
        <table className="w-full min-w-[880px] text-sm">
          <thead><tr className="border-b border-line text-left text-[11px] uppercase tracking-wider text-muted">
            <th className="px-4 py-2">#</th><th>{t('seat_rank_candidate')}</th><th>{t('seat_party')}</th><th className="text-right">{t('seat_votes')}</th><th className="pl-3">{t('seat_share')}</th>
            <th>{t('seat_status')}</th><th className="text-right">{t('cp_age')}</th><th className="text-right">{t('cp_assets')}</th><th className="text-right">{t('cp_liabilities')}</th><th className="pr-4 text-right">{t('cp_criminal_cases')}</th>
          </tr></thead>
          <tbody>
            {vm.view.candidates.map((c, i) => (
              <tr key={c.key} className="border-b border-line/60">
                <td className="px-4 py-2 text-muted">{c.nota ? '' : i + 1}</td>
                <td><div className="flex items-center gap-2"><Avatar name={c.name} photo={c.photo} size={32} />
                  {c.personId ? <Link to={vm.personHref(c.personId)} className="font-semibold hover:underline">{c.name}</Link> : <span className="font-semibold">{c.nota ? t('seat_nota') : c.name}</span>}
                  {c.incumbent && <span className="rounded-full border border-accent/50 px-1.5 text-[10px] text-accent">{t('seat_incumbent')}</span>}</div></td>
                <td>{c.partyId && <Link to={vm.partyHref(c.partyId)} className="flex items-center gap-1.5 hover:underline"><PartyMark mark={c.mark} color={c.color} label={c.partyLabel} size={24} />{c.partyLabel}</Link>}</td>
                <td className="tabular text-right font-semibold">{formatIN(c.votes)}</td>
                <td className="pl-3"><span className="tabular mr-2 text-xs">{c.share}%</span><span className="inline-block h-1.5 w-24 overflow-hidden rounded-full bg-page align-middle"><span className="block h-full" style={{ width: `${c.share}%`, background: c.color }} /></span></td>
                <td>{c.pill && <span className={cn('rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.pill])}>{t(`studio_status_${c.pill.toLowerCase()}`)}</span>}</td>
                <td className="tabular text-right">{c.affidavit?.age ?? ''}</td>
                <td className="tabular text-right">{formatRupees(c.affidavit?.assets ?? null) ?? ''}</td>
                <td className="tabular text-right">{formatRupees(c.affidavit?.liabilities ?? null) ?? ''}</td>
                <td className="pr-4 text-right">{c.affidavit?.criminalCases != null && (c.affidavit.criminalCases > 0
                  ? <span className="rounded-md bg-warn/15 px-1.5 py-0.5 text-xs font-bold text-warn-text">{c.affidavit.criminalCases}</span>
                  : <span className="text-muted">0</span>)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>

      {(vm.history.length > 0 || vm.notes.length > 0) && (
        <div className="grid gap-4 lg:grid-cols-2">
          {vm.history.length > 0 && (
            <section className={tile}>
              <h2 className={cn(h2, 'flex items-center gap-2')}>{t('cp_seat_history')}{vm.dominance && <span className="rounded-md border border-warn/50 px-1.5 text-[11px] text-warn-text">{t(`studio_chip_${vm.dominance}`, vm.dominance)}</span>}</h2>
              <ol className="flex flex-col gap-2">
                {vm.history.map(h => {
                  const m = h.party ? vm.partyMeta.get(h.party) : undefined;
                  return (
                    <li key={h.year} className="rounded-tile border border-line p-3">
                      <div className="flex justify-between"><span className="font-display font-bold">{h.year}</span><span className="tabular text-sm text-ok-text">+{formatIN(h.margin)}</span></div>
                      <div className="mt-1 flex items-center gap-1.5"><PartyMark mark={m?.mark ?? null} color={m?.color ?? null} label={m?.abbreviation ?? h.party ?? ''} /><span className="font-semibold">{h.candidate}</span><span className="text-muted">({m?.abbreviation ?? h.party})</span>{h.vote_share != null && <span className="ml-auto text-sm">{h.vote_share}%</span>}</div>
                      {h.runner_up && <div className="mt-0.5 text-xs text-muted">{t('cp_runner_up', { name: `${h.runner_up}${h.runner_up_party ? ` (${vm.partyMeta.get(h.runner_up_party)?.abbreviation ?? h.runner_up_party})` : ''}` })}</div>}
                    </li>
                  );
                })}
              </ol>
            </section>
          )}
          {vm.notes.length > 0 && (
            <section className={tile}>
              <h2 className={h2}>{t('cp_insights')}</h2>
              {vm.notes.map(n => <p key={n.kind} className="mb-2 rounded-tile border border-warn/50 bg-warn/10 px-3 py-2 text-sm text-warn-text">⚠ {n.kind === 'threeWay' ? t('seat_three_way') : t('seat_spoiler', { party: n.party, votes: formatIN(n.votes), margin: formatIN(n.margin) })}</p>)}
            </section>
          )}
        </div>
      )}
    </PageShell>
  );
}
