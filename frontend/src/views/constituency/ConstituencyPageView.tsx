import { Link } from 'react-router-dom';
import type { CSSProperties, ReactElement } from 'react';
import { useTranslation } from 'react-i18next';
import type { ConstituencyPageVM } from '../../viewmodels/pages/useConstituencyPageVM';
import { PageShell } from '../page/PageShell';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN, formatRupees } from '../ui/format';
import { LiveChip } from '../seat/SeatDialog';
import { ShareMenu } from '../dashboard/ShareMenu';
import { LocatorMap } from './LocatorMap';
import { cn } from '../ui/cn';

const tile = 'rounded-2xl border border-line bg-tile';
const tileHead = 'flex items-center justify-between border-b border-line/60 pb-2.5 mb-3';
const h2 = 'font-display text-sm font-bold uppercase tracking-wider text-ink';

/** A party colour (hex or var()) at a given opacity, for tints, glows and borders. */
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

type Cand = ConstituencyPageVM['view']['candidates'][number];

function CandidateName({ c, vm, strong }: { c: Cand; vm: ConstituencyPageVM; strong?: boolean }) {
  const { t } = useTranslation();
  const cls = cn('text-sm font-bold', strong ? 'text-ink' : 'text-ink/85');
  return (
    <>
      {c.personId ? <Link to={vm.personHref(c.personId)} className={cn(cls, 'hover:underline')}>{c.name}</Link> : <span className={cls}>{c.nota ? t('seat_nota') : c.name}</span>}
      {c.incumbent && <span className="rounded px-1.5 py-0.5 text-[10px] font-medium text-warn-text">{t('seat_incumbent')}</span>}
    </>
  );
}

function PartyCell({ c, vm, size }: { c: Cand; vm: ConstituencyPageVM; size: 16 | 24 }) {
  if (!c.partyId) return null;
  return <Link to={vm.partyHref(c.partyId)} className="flex items-center gap-2 font-semibold text-ink/85 hover:underline"><PartyMark mark={c.mark} color={c.color} label={c.partyLabel} size={size} />{c.partyLabel}</Link>;
}

/** Status pill: WON/LEADING tinted; other statuses get no pill (design notes). */
function Pill({ c }: { c: Cand }) {
  const { t } = useTranslation();
  if (!c.pill) return null;
  return <span className="inline-flex rounded border border-ok-text/40 bg-ok-text/15 px-2 py-0.5 text-[10px] font-black uppercase tracking-wider text-ok-text">{t(`studio_status_${c.pill.toLowerCase()}`)}</span>;
}

function CasesChip({ n }: { n: number | null | undefined }) {
  const { t } = useTranslation();
  if (n == null) return null;
  return n > 0
    ? <span className="inline-flex rounded border border-warn/40 bg-warn/20 px-2 py-0.5 text-[10px] font-bold text-warn-text">{t('pp_cases', { count: n })}</span>
    : <span className="text-muted">0</span>;
}

/** One muted line: "Age 64 · Assets ₹4.8 Cr · Liabilities ₹32 L · Criminal cases 1"; parts without data are left out. */
function AffidavitLine({ c }: { c: Cand }) {
  const { t } = useTranslation();
  const a = c.affidavit;
  if (!a) return null;
  const parts = [
    a.age != null && <span key="age">{t('cp_age')} {a.age}</span>,
    a.assets != null && <span key="assets">{t('cp_assets')} {formatRupees(a.assets)}</span>,
    a.liabilities != null && <span key="liab">{t('cp_liabilities')} {formatRupees(a.liabilities)}</span>,
    a.criminalCases != null && <span key="cases" className={cn(a.criminalCases > 0 && 'font-semibold text-warn-text')}>{t('cp_criminal_cases')} {a.criminalCases}</span>,
  ].filter(Boolean) as ReactElement[];
  if (!parts.length) return null;
  return <p data-affidavit className="mt-0.5 truncate text-xs text-muted">{parts.flatMap((p, i) => (i ? [' · ', p] : [p]))}</p>;
}

function Contender({ c, vm, rank, right }: { c: Cand; vm: ConstituencyPageVM; rank: number; right?: boolean }) {
  const { t } = useTranslation();
  return (
    <div className={cn('flex min-w-0 flex-col gap-2', right && 'items-end text-right')}>
      <div className={cn('flex items-start gap-3', right && 'flex-row-reverse')}>
        <div className="relative shrink-0">
          <div className="h-14 w-14 overflow-hidden rounded-xl border-2 shadow-md sm:h-16 sm:w-16" style={{ borderColor: tint(c.color, 80) }}>
            <Avatar name={c.name} photo={c.photo} size="fill" className="h-full w-full rounded-none border-0 text-base" />
          </div>
          <span className={cn('absolute -bottom-2 rounded px-1.5 py-0.5 font-display text-[10px] font-black uppercase tracking-wider', right ? '-left-1 bg-line text-ink/80' : '-right-1 text-white')}
            style={right ? undefined : { background: c.color }}>#{rank}</span>
        </div>
        <div className="min-w-0">
          <div className={cn('flex flex-wrap items-center gap-1.5', right && 'justify-end')}>
            {c.pill ? <Pill c={c} /> : <span className="rounded border border-line px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-muted">{t('studio_status_trailing')}</span>}
            {c.incumbent && <span className="rounded bg-tile-raised px-1.5 py-0.5 text-[10px] font-medium text-muted">{t('seat_incumbent')}</span>}
          </div>
          <h3 className="mt-1 truncate text-base font-bold text-ink">
            {c.personId ? <Link to={vm.personHref(c.personId)} className="text-ink hover:underline">{c.name}</Link> : c.name}
          </h3>
          {c.partyId && <Link to={vm.partyHref(c.partyId)} className={cn('mt-0.5 flex items-center gap-1.5 text-xs font-semibold text-ink/80 hover:underline', right && 'flex-row-reverse')}><PartyMark mark={c.mark} color={c.color} label={c.partyLabel} />{c.partyLabel}</Link>}
        </div>
      </div>
      <div>
        <div className="tabular font-display text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">{formatIN(c.votes)}</div>
        <div className={cn('flex items-baseline gap-2', right && 'flex-row-reverse')}>
          <span className="tabular text-sm font-bold" style={{ color: c.color }}>{c.share}%</span>
          <span className="text-[11px] uppercase text-muted">{t('cp_share_label')}</span>
        </div>
      </div>
    </div>
  );
}

type Insight = ConstituencyPageVM['insights'][number];

const WARN_PATH = 'M12 9v2m0 4h.01M5.07 19h13.86c1.54 0 2.5-1.67 1.73-3L13.73 4a2 2 0 00-3.46 0L3.34 16c-.77 1.33.19 3 1.73 3z';
const INFO_PATH = 'M12 8h.01M11 12h1v4h1M12 3a9 9 0 110 18 9 9 0 010-18z';
const SWAP_PATH = 'M7 7h13l-3-3M17 17H4l3 3';

function InsightCard({ i, vm }: { i: Insight; vm: ConstituencyPageVM }) {
  const { t } = useTranslation();
  const party = (id: string) => vm.partyMeta.get(id)?.abbreviation ?? id;
  const partyColor = (id: string) => vm.partyMeta.get(id)?.color ?? 'var(--color-accent)';
  let tone: 'warn' | 'info' | 'party' = 'info';
  let color = 'var(--color-accent-text)';
  let title = '';
  let body = '';
  let icon = INFO_PATH;
  switch (i.kind) {
    case 'flip': tone = 'party'; color = partyColor(i.to); icon = SWAP_PATH; title = t('ins_flip_title'); body = t('ins_flip_body', { to: party(i.to), from: party(i.from), year: i.fromYear }); break;
    case 'hold': tone = 'party'; color = partyColor(i.party); title = t('ins_hold_title', { party: party(i.party) }); body = t('ins_hold_body', { count: i.streak, year: vm.history[0]?.year }); break;
    case 'photoFinish': tone = 'warn'; icon = WARN_PATH; title = t('ins_photo_title'); body = t('ins_photo_body', { margin: formatIN(i.margin), pct: i.pct }); break;
    case 'nota': tone = 'warn'; icon = WARN_PATH; title = t('ins_nota_title'); body = t('ins_nota_body', { nota: formatIN(i.nota), margin: formatIN(i.margin) }); break;
    case 'incumbent': title = t(i.won ? 'ins_inc_kept_title' : 'ins_inc_lost_title'); body = t(i.won ? 'ins_inc_kept_body' : 'ins_inc_lost_body', { name: i.name }); break;
    case 'marginChange': title = t(i.now >= i.prev ? 'ins_margin_up_title' : 'ins_margin_down_title'); body = t('ins_margin_body', { prev: formatIN(i.prev), year: i.prevYear, now: formatIN(i.now) }); break;
    case 'threeWay': tone = 'warn'; icon = WARN_PATH; title = t('cp_three_way_title'); body = t('cp_three_way_body', { margin: formatIN(i.margin), name: i.thirdName, votes: formatIN(i.thirdVotes) }); break;
    case 'spoiler': tone = 'warn'; icon = WARN_PATH; title = t('cp_spoiler_title'); body = t('seat_spoiler', { party: party(i.party), votes: formatIN(i.votes), margin: formatIN(i.margin) }); break;
    case 'affidavit': title = t('ins_aff_title'); body = [t('ins_aff_cases', { withCases: i.withCases, total: i.total }), i.winnerCases != null ? t('ins_aff_winner', { n: i.winnerCases }) : null, i.richest ? t('ins_aff_richest', { name: i.richest.name, assets: formatRupees(i.richest.assets) }) : null].filter(Boolean).join(' '); break;
  }
  if (tone === 'warn') color = 'var(--color-warn-text)';
  const style = tone === 'warn' ? undefined : { borderColor: tint(color, 35), background: tint(color, 7) };
  return (
    <div className={cn('flex items-start gap-3 rounded-lg border p-3', tone === 'warn' && 'border-warn/50 bg-warn/10')} style={style}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="mt-0.5 h-4 w-4 shrink-0" style={{ color }} aria-hidden><path d={icon} strokeLinecap="round" strokeLinejoin="round" /></svg>
      <div className="min-w-0">
        <div className="text-sm font-bold" style={{ color }}>{title}</div>
        <p className="mt-0.5 text-xs leading-relaxed text-ink/80">{body}</p>
      </div>
    </div>
  );
}

export function ConstituencyPageView({ vm }: { vm: ConstituencyPageVM }) {
  const { t } = useTranslation();
  const back = { href: vm.electionHref, label: t('cp_back') };
  if (vm.status !== 'ready') {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('cp_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const ranked = vm.view.candidates.filter(c => !c.nota);
  const [lead, second] = ranked;
  const others = lead ? Math.max(0, Math.round((100 - lead.share - (second?.share ?? 0)) * 10) / 10) : 0;
  const hasNota = vm.view.candidates.some(c => c.nota);
  const contestants = t('cp_contestants', { count: ranked.length });
  const leaderColor = lead?.color ?? 'var(--color-accent)';
  const facts = ([
    ['seat_electors', vm.facts.electors != null ? formatIN(vm.facts.electors) : null, false],
    ['cp_votes_polled', vm.facts.votesPolled != null ? formatIN(vm.facts.votesPolled) : null, false],
    ['seat_turnout', vm.facts.turnout != null ? `${vm.facts.turnout}%` : null, true],
    ['seat_phase', vm.facts.phase != null ? t('seat_phase_n', { n: vm.facts.phase }) : null, false],
    ['cp_region', vm.facts.region, false], ['cp_district', vm.facts.district, false],
  ] as const).filter(([, v]) => v);
  const house = vm.election?.type === 'LS' ? t('cp_house_LS') : t('cp_house_VS');
  return (
    <PageShell back={back}>
      {/* Header band */}
      <section className="flex flex-col justify-between gap-3 border-b border-line pb-3 md:flex-row md:items-end">
        <div className="space-y-1.5">
          <nav aria-label="Breadcrumb" className="flex flex-wrap items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted">
            <Link to={vm.electionHref} className="hover:text-ink">{vm.electionName}</Link>
            {vm.stateName && <><span className="text-line">›</span><span>{vm.stateName}</span></>}
            {vm.districtName && <><span className="text-line">›</span><span className="text-ink/80">{vm.districtName}</span></>}
          </nav>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-extrabold uppercase tracking-tight text-ink sm:text-5xl">{vm.name}</h1>
            {(vm.constNo != null || vm.type) && <span className="rounded border border-line bg-tile px-2.5 py-1 font-display text-xs font-bold uppercase tracking-wider text-ink/80">{[vm.constNo != null && t('seat_no', { n: vm.constNo }), vm.type && vm.type !== 'GEN' && vm.type].filter(Boolean).join(' · ')}</span>}
            <LiveChip live={vm.live} />
          </div>
        </div>
        <div className="flex items-center gap-2.5">
          <button type="button" onClick={vm.onToggleTrack} aria-pressed={vm.tracked}
            className="inline-flex items-center gap-2 rounded-lg bg-accent px-4 py-2 text-xs font-semibold uppercase tracking-wider text-on-accent shadow-sm hover:opacity-90 aria-pressed:bg-tile-raised aria-pressed:text-accent-text">
            {vm.tracked ? t('studio_tracked') : t('studio_track')}
          </button>
          <ShareMenu text={vm.shareText} />
        </div>
      </section>

      {/* Above the fold */}
      <section className="grid grid-cols-1 gap-3 lg:grid-cols-12">
        {lead && (
          <section className={cn(tile, 'relative flex flex-col justify-between overflow-hidden p-4 shadow-xl sm:p-5', facts.length || vm.locator ? 'lg:col-span-7' : 'lg:col-span-12')} aria-label={t('cp_head_to_head')}>
            <div className="pointer-events-none absolute -left-24 -top-24 h-64 w-64 rounded-full blur-3xl" style={{ background: tint(lead.color, 12) }} aria-hidden />
            {second && <div className="pointer-events-none absolute -bottom-24 -right-24 h-64 w-64 rounded-full blur-3xl" style={{ background: tint(second.color, 12) }} aria-hidden />}
            <div className="relative">
              <div className={tileHead}>
                <span className="text-xs font-semibold uppercase tracking-wider text-muted">{t('cp_head_to_head')}</span>
                {vm.facts.progress && <span className="font-mono text-xs text-muted">{t('cp_round_of', vm.facts.progress)}</span>}
              </div>
              <div className="grid grid-cols-2 items-start gap-4 sm:gap-8">
                <Contender c={lead} vm={vm} rank={1} />
                {second && <Contender c={second} vm={vm} rank={2} right />}
              </div>
            </div>
            {vm.view.totalVotes > 0 && (
              <div className="relative mt-4 space-y-2 border-t border-line/70 pt-3">
                {vm.view.margin != null && (
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium uppercase tracking-wider text-muted">{t('seat_margin')}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium" style={{ color: lead.color }}>{t('cp_ahead_by', { party: lead.partyLabel || lead.name })}</span>
                      <span className="tabular rounded border border-ok-text/30 bg-ok-text/10 px-2.5 py-0.5 font-display text-sm font-extrabold text-ok-text">{t('cp_margin_votes', { n: formatIN(vm.view.margin) })}</span>
                    </div>
                  </div>
                )}
                <div className="flex h-3.5 w-full overflow-hidden rounded-full bg-page p-[2px]">
                  <div className="h-full rounded-l-full" style={{ width: `${lead.share}%`, background: lead.color }} />
                  <div className="h-full w-1 shrink-0 bg-tile" />
                  {second && <div className="h-full" style={{ width: `${second.share}%`, background: second.color }} />}
                  <div className="h-full flex-1 rounded-r-full bg-tile-raised" />
                </div>
                <div className="flex items-center justify-between pt-0.5 text-[11px] text-muted">
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: lead.color }} />{lead.partyLabel || lead.name} {lead.share}%</span>
                  <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm bg-tile-raised" />{t('cp_others_nota', { pct: others })}</span>
                  {second && <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: second.color }} />{second.partyLabel || second.name} {second.share}%</span>}
                </div>
              </div>
            )}
          </section>
        )}
        {facts.length > 0 && (
          <article className={cn(tile, 'flex flex-col justify-between p-4 shadow-xl lg:col-span-3')}>
            <div>
              <div className={tileHead}><h2 className={h2}>{t('cp_seat_facts')}</h2><span className="h-2 w-2 rounded-full bg-warn" aria-hidden /></div>
              <dl className="space-y-1 text-xs">
                {facts.map(([k, v, good], i) => (
                  <div key={k} className={cn('flex items-center justify-between py-1.5', i < facts.length - 1 && 'border-b border-line/40')}>
                    <dt className="text-muted">{t(k)}</dt><dd className={cn('tabular font-display text-sm font-bold', good ? 'text-ok-text' : 'text-ink')}>{v}</dd>
                  </div>
                ))}
              </dl>
            </div>
            {vm.facts.progress && (
              <div className="mt-3 rounded-lg border border-line/60 bg-page/60 p-2.5">
                <div className="flex items-center justify-between text-[11px]"><span className="text-muted">{t('cp_counting_progress')}</span>
                  <span className="font-mono font-semibold text-warn-text">{Math.round((vm.facts.progress.current / vm.facts.progress.total) * 1000) / 10}% ({vm.facts.progress.current}/{vm.facts.progress.total})</span></div>
                <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-line"><div className="h-full rounded-full bg-warn" style={{ width: `${(vm.facts.progress.current / vm.facts.progress.total) * 100}%` }} /></div>
              </div>
            )}
          </article>
        )}
        {vm.locator && (
          <article className={cn(tile, 'flex flex-col p-4 shadow-xl lg:col-span-2')}>
            <div className={tileHead}><h2 className={h2}>{t('cp_locator')}</h2>{vm.stateName && <span className="text-[10px] text-muted">{vm.stateName}</span>}</div>
            <div className="flex aspect-square w-full items-center justify-center overflow-hidden rounded-lg border border-line/80 bg-page/80 p-2">
              <LocatorMap features={vm.locator.features} seat={vm.locator.seat} label={vm.name} color={leaderColor} />
            </div>
            <div className="mt-2 rounded border bg-page/90 px-2 py-1 text-center" style={{ borderColor: tint(leaderColor, 40) }}>
              <span className="block font-display text-[11px] font-bold uppercase tracking-wide" style={{ color: leaderColor }}>{vm.name}{vm.constNo != null && ` (#${vm.constNo})`}</span>
              {vm.districtName && <span className="block text-[9px] text-muted">{vm.districtName}</span>}
            </div>
          </article>
        )}
      </section>

      {/* All candidates */}
      <section className={cn(tile, 'overflow-hidden shadow-xl')} aria-label={t('cp_all_candidates')}>
        <div className="flex flex-col justify-between gap-2 border-b border-line bg-page/30 px-4 py-3 sm:flex-row sm:items-center lg:px-5">
          <h2 className="flex items-center gap-2.5 font-display text-lg font-bold uppercase tracking-wide text-ink">
            <span>{t('cp_all_candidates')}</span>
            <span className="rounded-full border border-line bg-page px-2 py-0.5 font-sans text-xs font-medium normal-case tracking-normal text-muted">{hasNota ? t('cp_with_nota', { text: contestants }) : contestants}</span>
          </h2>
        </div>
        {/* Below lg: stacked rows (spec D10); lg+: the full table. */}
        <ul className="flex list-none flex-col gap-2 p-3 lg:hidden">
          {vm.view.candidates.map((c, i) => (
            <li key={c.key} className={cn('rounded-xl border border-line bg-page/40 p-3', i === 0 && !c.nota && 'bg-[color:var(--lead)]')} style={i === 0 ? { '--lead': tint(c.color, 6) } as CSSProperties : undefined}>
              <div className="flex items-start gap-3">
                <span className="w-5 shrink-0 pt-2.5 font-mono text-xs text-muted">{c.nota ? '' : i + 1}</span>
                <Avatar name={c.name} photo={c.photo} size={36} className="border" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5"><CandidateName c={c} vm={vm} strong={i === 0} /><PartyCell c={c} vm={vm} size={16} /></div>
                  <AffidavitLine c={c} />
                </div>
                <div className="shrink-0 text-right">
                  <div className="tabular font-display text-sm font-bold">{formatIN(c.votes)}</div>
                  <div className="tabular text-xs" style={{ color: c.color }}>{c.share}%</div>
                  <Pill c={c} />
                </div>
              </div>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full" style={{ width: `${c.share}%`, background: c.color }} /></div>
            </li>
          ))}
        </ul>
        <div className="hidden overflow-x-auto lg:block">
          <table className="w-full border-collapse whitespace-nowrap text-left text-xs [&_td]:border-x-0 [&_td]:border-t-0 [&_th]:border-0">
            <thead><tr className="border-b border-line bg-page/40 font-display text-[11px] uppercase tracking-wider text-muted">
              <th scope="col" className="w-12 px-4 py-2.5 text-center">#</th><th scope="col" className="px-4 py-2.5">{t('seat_rank_candidate')}</th><th scope="col" className="px-4 py-2.5">{t('seat_party')}</th>
              <th scope="col" className="px-4 py-2.5 text-right">{t('seat_votes')}</th><th scope="col" className="px-4 py-2.5">{t('seat_share')}</th><th scope="col" className="px-4 py-2.5 text-center">{t('seat_status')}</th>
              <th scope="col" className="px-3 py-2.5 text-center">{t('cp_age')}</th><th scope="col" className="px-3 py-2.5 text-right">{t('cp_assets')}</th><th scope="col" className="px-3 py-2.5 text-right">{t('cp_liabilities')}</th><th scope="col" className="px-4 py-2.5 text-center">{t('cp_criminal_cases')}</th>
            </tr></thead>
            <tbody className="divide-y divide-line/50">
              {vm.view.candidates.map((c, i) => (
                <tr key={c.key} className="transition-colors hover:bg-tile-raised/60" style={i === 0 && !c.nota ? { background: tint(c.color, 5) } : undefined}>
                  <td className={cn('px-4 py-1.5 text-center font-mono', i === 0 ? 'font-bold text-ink' : 'text-muted')}>{c.nota ? '' : i + 1}</td>
                  <td className="px-4 py-1.5"><div className="flex items-center gap-3">
                    <span className="rounded-full border" style={{ borderColor: c.partyId ? tint(c.color, 80) : 'var(--color-line)' }}><Avatar name={c.name} photo={c.photo} size={26} className="border-0 text-[10px]" /></span>
                    <div className="flex flex-col"><div className="flex items-center gap-1"><CandidateName c={c} vm={vm} strong={i === 0} /></div></div>
                  </div></td>
                  <td className="px-4 py-1.5"><PartyCell c={c} vm={vm} size={16} /></td>
                  <td className={cn('tabular px-4 py-1.5 text-right font-display text-sm font-bold', i === 0 ? 'text-ink' : 'text-ink/85')}>{formatIN(c.votes)}</td>
                  <td className="px-4 py-1.5"><div className="flex items-center gap-2">
                    <span className="tabular inline-block w-12 text-right font-semibold" style={{ color: c.nota ? undefined : c.color }}>{c.share}%</span>
                    <span className="h-1.5 w-24 overflow-hidden rounded-full bg-line"><span className="block h-full rounded-full" style={{ width: `${c.share}%`, background: c.color }} /></span>
                  </div></td>
                  <td className="px-4 py-1.5 text-center"><Pill c={c} /></td>
                  <td className="tabular px-3 py-1.5 text-center font-mono text-ink/80">{c.affidavit?.age ?? ''}</td>
                  <td className="tabular px-3 py-1.5 text-right font-mono font-medium text-ink/90">{formatRupees(c.affidavit?.assets ?? null) ?? ''}</td>
                  <td className="tabular px-3 py-1.5 text-right font-mono text-muted">{formatRupees(c.affidavit?.liabilities ?? null) ?? ''}</td>
                  <td className="px-4 py-1.5 text-center"><CasesChip n={c.affidavit?.criminalCases} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {vm.view.totalVotes > 0 && (
          <div className="flex justify-end border-t border-line bg-page/40 px-4 py-2 font-mono text-[11px] text-muted lg:px-5">{t('cp_total_counted', { n: formatIN(vm.view.totalVotes) })}</div>
        )}
      </section>

      {(vm.history.length > 0 || vm.insights.length > 0) && (
        <section className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {vm.history.length > 0 && (
            <article className={cn(tile, 'p-4 shadow-xl lg:p-5')}>
              <div className={tileHead}>
                <div className="flex items-center gap-2.5">
                  <h2 className={h2}>{t('cp_seat_history')}</h2>
                  {vm.dominance && <span className="rounded border border-warn/40 bg-warn/20 px-2 py-0.5 text-[10px] font-bold uppercase text-warn-text">{t(`cp_class_${vm.dominance}`)}</span>}
                </div>
                <span className="text-xs text-muted">{t('cp_last_n', { count: vm.history.length })}</span>
              </div>
              <ol className="relative list-none space-y-3 pl-0 before:absolute before:bottom-0 before:left-3 before:top-0 before:w-0.5 before:bg-line">
                {vm.history.map((h, i) => {
                  const m = h.party ? vm.partyMeta.get(h.party) : undefined;
                  const color = m?.color ?? 'var(--color-muted)';
                  const label = m?.abbreviation ?? h.party ?? '';
                  return (
                    <li key={`${h.year}-${i}`} className="relative flex items-start gap-3">
                      <span className="relative z-10 grid h-6 w-6 shrink-0 place-items-center rounded-full border-2 bg-tile" style={{ borderColor: color }} aria-hidden><span className="h-2 w-2 rounded-full" style={{ background: color }} /></span>
                      <div className="flex-1 rounded-lg border border-line/80 bg-page/60 px-3 py-2.5">
                        <div className="flex items-center justify-between">
                          <span className="font-display text-sm font-bold text-ink">{h.year} {house}</span>
                          <span className="tabular font-mono text-xs font-semibold text-ok-text">{t('cp_margin_suffix', { n: formatIN(h.margin) })}</span>
                        </div>
                        <div className="mt-1.5 flex items-center justify-between text-xs">
                          <div className="flex min-w-0 items-center gap-1.5"><PartyMark mark={m?.mark ?? null} color={m?.color ?? null} label={label} /><span className="truncate font-bold text-ink/90">{h.candidate}</span><span className="text-muted">({label})</span></div>
                          {h.vote_share != null && <span className="font-mono font-bold" style={{ color }}>{h.vote_share}%</span>}
                        </div>
                        {h.runner_up && <div className="mt-1 text-[11px] text-muted">{t('cp_runner_up', { name: `${h.runner_up}${h.runner_up_party ? ` (${vm.partyMeta.get(h.runner_up_party)?.abbreviation ?? h.runner_up_party})` : ''}` })}</div>}
                      </div>
                    </li>
                  );
                })}
              </ol>
            </article>
          )}
          {vm.insights.length > 0 && (
            <article className={cn(tile, 'space-y-3 p-4 shadow-xl lg:p-5')}>
              <div className={cn(tileHead, 'mb-0')}><h2 className={h2}>{t('cp_insights')}</h2></div>
              <div className="grid grid-cols-1 gap-2.5 xl:grid-cols-2">
                {vm.insights.map((i, n) => <InsightCard key={`${i.kind}-${n}`} i={i} vm={vm} />)}
              </div>
            </article>
          )}
        </section>
      )}
    </PageShell>
  );
}
