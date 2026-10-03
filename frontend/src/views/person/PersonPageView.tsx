import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { CSSProperties, ReactNode } from 'react';
import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';
import { PageShell } from '../page/PageShell';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { Icon, type IconName } from '../ui/Icon';
import { formatIN, formatRupees } from '../ui/format';
import { cn } from '../ui/cn';

type Contest = PersonPageVM['contests'][number];

/** A party colour (hex or var()) at a given opacity, for tinted chips, glows and borders. */
const tint = (color: string, pct: number) => `color-mix(in srgb, ${color} ${pct}%, transparent)`;

const tile = 'rounded-2xl border border-line bg-tile';

/** Status colours of a contest: pill, timeline node and card hover border. */
function statusColor(c: Contest): string {
  if (c.status === 'WON') return 'var(--color-ok-text)';
  if (c.status === 'LOST') return 'var(--color-live-text)';
  if (c.status === 'LEADING') return c.color;
  return 'var(--color-muted)';
}

/** One cell of the compact stats strip: icon + label on top, value with its sub-line beside it. */
function Stat({ label, icon, iconColor, value, valueColor, sub, subColor }: {
  label: string; icon: IconName; iconColor?: string; value: string; valueColor?: string; sub?: string | null; subColor?: string;
}) {
  return (
    <div className="flex min-w-0 flex-col justify-center bg-tile px-4 py-2.5">
      <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-muted">
        <span style={{ color: iconColor }} className={iconColor ? undefined : 'opacity-60'}><Icon name={icon} className="h-3.5 w-3.5" /></span>
        <span className="truncate">{label}</span>
      </div>
      <div className="mt-0.5 flex min-w-0 items-baseline gap-2">
        <span className="tabular font-display text-2xl font-bold leading-none" style={{ color: valueColor }}>{value}</span>
        {sub && <span className="truncate text-[11px] font-semibold" style={{ color: subColor ?? 'var(--color-muted)' }}>{sub}</span>}
      </div>
    </div>
  );
}

function Metric({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <span className="block text-[11px] text-muted">{label}</span>
      <span className="tabular font-display text-base font-bold" style={{ color }}>{value}</span>
    </div>
  );
}

function ContestCard({ c, current }: { c: Contest; current: boolean }) {
  const { t } = useTranslation();
  const sc = statusColor(c);
  const marginLabel = c.status === 'WON' ? t('pp_victory_margin') : c.status === 'LOST' ? t('pp_defeat_margin') : t('pp_lead_margin');
  const marginSign = c.status === 'LOST' || c.status === 'TRAILING' ? '−' : '+';
  const live = c.status === 'LEADING' || c.status === 'TRAILING';
  return (
    <li className="group relative">
      {/* Timeline node */}
      <span className="absolute -left-6 top-3.5 grid h-4 w-4 -translate-x-[5px] place-items-center rounded-full border-2 bg-tile sm:-left-8" style={{ borderColor: sc }} aria-hidden>
        <span className={cn('h-1.5 w-1.5 rounded-full', live && 'animate-ping')} style={{ background: sc }} />
      </span>
      <div className="relative rounded-xl border border-line bg-page px-3.5 py-3 transition-colors" style={{ borderColor: current && live ? tint(sc, 40) : undefined }}>
        {/* The whole card opens the seat; the party link sits above that overlay, outside it. */}
        <Link to={c.constHref} aria-label={`${c.electionName} · ${c.constituency}`} className="absolute inset-0 rounded-xl border border-transparent transition-colors group-hover:border-[color:var(--hover)]" style={{ '--hover': tint(sc, 50) } as CSSProperties} />
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg border border-line bg-tile p-0.5">
              {c.partyId ? <PartyMark mark={c.mark} color={c.color} label={c.partyLabel} size={16} /> : null}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-x-2 text-sm font-bold text-ink">
                <span>{c.electionName}</span><span className="font-normal text-muted">· {c.constituency}</span>
              </div>
              {c.partyHref && (
                <div className="flex flex-wrap items-center gap-1 text-xs">
                  <Link to={c.partyHref} className="relative z-10 font-semibold hover:underline" style={{ color: current || c.firstUnderParty ? c.color : 'var(--color-muted)' }}>{c.partyName}</Link>
                  {c.firstUnderParty && <span className="text-muted">({t('pp_first_under', { party: c.partyLabel })})</span>}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className={cn('inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-bold uppercase', live && 'animate-pulse')}
              style={{ color: sc, background: tint(sc, 18), borderColor: tint(sc, 40) }}>
              {live && <span className="h-1.5 w-1.5 rounded-full" style={{ background: sc }} />}
              {t(`studio_status_${c.status.toLowerCase()}`)}
            </span>
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-line bg-tile text-muted group-hover:text-ink" aria-hidden><Icon name="arrow" /></span>
          </div>
        </div>
        <div className="mt-2.5 grid grid-cols-3 gap-3 border-t border-line/80 pt-2">
          <Metric label={t('pp_votes')} value={formatIN(c.votes)} />
          {c.share != null && <Metric label={t('pp_vote_share')} value={`${c.share}%`} />}
          {c.margin != null && <Metric label={marginLabel} value={`${marginSign}${formatIN(c.margin)}`} color={c.status === 'LOST' || c.status === 'TRAILING' ? 'var(--color-live-text)' : 'var(--color-ok-text)'} />}
        </div>
      </div>
    </li>
  );
}

function AffidavitTile({ vm }: { vm: PersonPageVM }) {
  const { t } = useTranslation();
  const latest = vm.latest!;
  const withAssets = vm.affidavit.filter(p => p.assets != null);
  const first = withAssets[0];
  const last = withAssets[withAssets.length - 1];
  const max = Math.max(1, ...withAssets.map(p => p.assets!));
  const growth = first && last && first !== last && first.assets! > 0 ? Math.round(((last.assets! - first.assets!) / first.assets!) * 100) : null;
  const house = (h: 'LS' | 'VS' | null) => (h === 'LS' ? t('lok_sabha') : h === 'VS' ? t('vidhan_sabha') : null);
  const newestFirst = [...vm.affidavit].reverse();
  return (
    <section className={cn(tile, 'space-y-4 p-4 lg:p-5')}>
      <div className="flex items-center justify-between border-b border-line pb-3">
        <h2 className="font-display text-lg font-bold uppercase tracking-wide text-ink">{t('pp_affidavit_title')}</h2>
        <span className="text-muted"><Icon name="wallet" className="h-[18px] w-[18px]" /></span>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {latest.assets != null && (
          <div className="rounded-xl border border-line bg-page px-3 py-2.5">
            <div className="text-[11px] text-muted">{t('pp_latest_assets')}</div>
            <div className="tabular mt-0.5 font-display text-2xl font-bold text-ok-text">{formatRupees(latest.assets)}</div>
            <div className="mt-1 text-[10px] text-muted">{t('pp_declared', { year: latest.year })}</div>
          </div>
        )}
        {latest.liabilities != null && (
          <div className="rounded-xl border border-line bg-page px-3 py-2.5">
            <div className="text-[11px] text-muted">{t('pp_latest_liabilities')}</div>
            <div className="tabular mt-0.5 font-display text-2xl font-bold text-ink">{formatRupees(latest.liabilities)}</div>
            <div className="mt-1 text-[10px] text-muted">{t('pp_declared', { year: latest.year })}</div>
          </div>
        )}
      </div>
      {latest.criminalCases != null && (
        <div className={cn('flex items-center justify-between rounded-xl border bg-page px-3 py-2', latest.criminalCases > 0 ? 'border-warn/30' : 'border-line')}>
          <div className="flex items-center gap-2">
            <span className={latest.criminalCases > 0 ? 'text-warn-text' : 'text-muted'}><Icon name="gavel" className="h-[18px] w-[18px]" /></span>
            <span className="text-xs text-muted">{t('pp_criminal_cases')}</span>
          </div>
          <span className={cn('rounded-full border px-2.5 py-0.5 text-xs font-bold', latest.criminalCases > 0 ? 'border-warn/30 bg-warn/20 text-warn-text' : 'border-line text-muted')}>
            {t('pp_cases', { count: latest.criminalCases })}
          </span>
        </div>
      )}
      {withAssets.length > 1 && (
        <div className="space-y-3">
          <div className="flex items-center justify-between text-xs">
            <span className="font-medium text-muted">{t('pp_asset_growth', { from: first.year, to: last.year })}</span>
            {growth != null && <span className="tabular text-[11px] font-semibold text-ok-text">{t('pp_growth_overall', { pct: growth > 0 ? `+${growth}` : growth })}</span>}
          </div>
          <div className="space-y-2 rounded-xl border border-line bg-page px-3 py-2.5">
            {[...withAssets].reverse().map((p, i) => (
              <div key={`${p.year}-${i}`}>
                <div className="mb-1 flex justify-between text-[11px]">
                  <span className={cn('font-medium', i === 0 ? 'text-ink' : 'text-muted')}>{i === 0 ? t('pp_latest_tag', { year: p.year }) : p.year}</span>
                  <span className={cn('tabular font-semibold', i === 0 ? 'font-bold text-ok-text' : 'text-muted')}>{formatRupees(p.assets)}</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-line">
                  <div className="h-full rounded-full bg-ok-text" style={{ width: `${(p.assets! / max) * 100}%`, opacity: Math.max(0.3, 1 - i * 0.2) }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
      <div className="space-y-2">
        <div className="text-xs font-semibold uppercase tracking-wider text-muted">{t('pp_declaration_log')}</div>
        <ul className="list-none divide-y divide-line pl-0 text-xs">
          {newestFirst.map((p, i) => (
            <li key={`${p.year}-${i}`} className="flex items-center justify-between py-1.5">
              <div><span className="font-bold text-ink">{p.year}</span>{house(p.house) && <span className="ml-1.5 text-[11px] text-muted">({house(p.house)})</span>}</div>
              <div className="text-right">
                <span className={cn('tabular font-semibold', i === 0 ? 'text-ok-text' : 'text-ink')}>{[formatRupees(p.assets), p.liabilities != null ? `− ${formatRupees(p.liabilities)}` : null].filter(Boolean).join(' / ')}</span>
                {p.criminalCases != null && <span className="ml-1.5 text-[10px] text-muted">| {t('pp_cases', { count: p.criminalCases })}</span>}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Sep() { return <span className="text-line" aria-hidden>|</span>; }

export function PersonPageView({ vm }: { vm: PersonPageVM }) {
  const { t } = useTranslation();
  const back = { href: '/', label: t('back') };
  if (vm.status !== 'ready') {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('pp_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const party = vm.currentParty;
  const accent = party?.color ?? 'var(--color-accent)';
  const g = vm.facts.gender;
  const facts: ReactNode[] = [
    vm.facts.age != null && <span key="age" className="font-medium text-ink">{t('pp_age', { n: vm.facts.age })}</span>,
    g && <span key="g">{g.labelKey ? t(g.labelKey) : g.raw}</span>,
    vm.facts.education && <span key="edu">{t('pp_education')}: <strong className="font-semibold text-ink">{vm.facts.education}</strong></span>,
    vm.facts.home && <span key="home">{t('pp_home')}: <strong className="font-semibold text-ink">{vm.facts.home}</strong></span>,
    vm.wikipedia && <a key="wiki" href={vm.wikipedia} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-accent-text hover:underline">{t('pp_wikipedia')}<Icon name="external" className="h-3.5 w-3.5" /></a>,
  ].filter(Boolean);
  const lastSwitch = vm.stats.switches[vm.stats.switches.length - 1];
  const housesSub = vm.stats.houses.length === 2 ? t('pp_houses_both') : vm.stats.houses[0] === 'LS' ? t('lok_sabha') : vm.stats.houses[0] === 'VS' ? t('vidhan_sabha') : null;
  // Timeline rail: from the current party's colour down to the oldest contest's party colour.
  const oldest = vm.contests[vm.contests.length - 1];
  const rail = `linear-gradient(to bottom, ${vm.contests[0]?.color ?? accent}, var(--color-line), ${oldest?.color ?? accent})`;
  return (
    <PageShell back={back}>
      {/* Profile header */}
      <header className={cn(tile, 'relative overflow-hidden p-4 lg:p-5')}>
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full blur-3xl" style={{ background: tint(accent, 12) }} aria-hidden />
        <div className="relative z-10 flex flex-col items-start gap-4 md:flex-row md:items-center lg:gap-6">
          <div className="shrink-0">
            <div className="relative">
              <div className="h-24 w-24 overflow-hidden rounded-2xl border-2 border-line bg-page shadow-md md:h-28 md:w-28">
                <Avatar name={vm.name} photo={vm.photo} size="fill" className="h-full w-full rounded-none border-0 object-top text-3xl" />
              </div>
              {party && (
                <span className="absolute -bottom-2 -right-2 grid h-8 w-8 place-items-center rounded-xl border-2 border-line bg-tile p-0.5 shadow-lg">
                  <PartyMark mark={party.mark} color={party.color} label={party.label} size={24} />
                </span>
              )}
            </div>
            {vm.photoCredit && (
              <a href={vm.photoCredit.source_url} target="_blank" rel="noopener noreferrer" className="mt-3 block w-24 break-words text-[11px] leading-tight text-muted hover:text-accent md:w-28">
                {t('person_photo_credit', { author: vm.photoCredit.author ?? t('person_photo_credit_unknown'), licence: vm.photoCredit.licence })}
              </a>
            )}
          </div>
          <div className="min-w-0 flex-1 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-4xl lg:text-5xl">{vm.name}</h1>
              <div className="flex flex-wrap items-center gap-2">
                {vm.incumbent && <span className="rounded-lg border border-accent/40 px-2.5 py-1 text-xs font-semibold text-accent-text">{t('seat_incumbent')}</span>}
                {party && (
                  <span className="inline-flex items-center gap-2 rounded-lg border px-3 py-1.5" style={{ background: tint(party.color, 10), borderColor: tint(party.color, 30) }}>
                    <PartyMark mark={party.mark} color={party.color} label={party.label} size={16} />
                    <span className="text-xs font-bold tracking-wide" style={{ color: party.color }}>{party.name && party.name !== party.label ? `${party.name} · ${party.label}` : party.label}</span>
                  </span>
                )}
              </div>
            </div>
            {facts.length > 0 && (
              <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs text-muted">
                {facts.flatMap((f, i) => (i === 0 ? [f] : [<Sep key={`s${i}`} />, f]))}
              </div>
            )}
            {vm.bio && <p className="max-w-4xl whitespace-pre-line text-sm leading-relaxed text-muted">{vm.bio}</p>}
          </div>
        </div>
      </header>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line lg:grid-cols-4">
        <Stat label={t('pp_contests')} icon="ballot" value={String(vm.stats.contests)} sub={housesSub} />
        <Stat label={t('pp_wins')} icon="star" iconColor="var(--color-ok-text)" value={String(vm.stats.wins)} valueColor="var(--color-ok-text)" />
        {vm.stats.winRate != null && <Stat label={t('pp_win_rate')} icon="percent" iconColor="var(--color-accent)" value={`${vm.stats.winRate}%`} sub={t('pp_win_rate_sub', { wins: vm.stats.wins, decided: vm.stats.decided })} />}
        <Stat label={t('pp_parties')} icon="swap" iconColor={lastSwitch ? accent : undefined} value={String(vm.stats.parties.length)}
          sub={lastSwitch ? t('pp_switch', { from: lastSwitch.fromLabel, to: lastSwitch.toLabel, year: lastSwitch.year }) : party?.label ?? null} subColor={accent} />
      </div>

      <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-12">
        {vm.contests.length > 0 && (
          <section className={cn(tile, 'p-4 lg:p-5', vm.affidavit.length > 0 ? 'lg:col-span-8' : 'lg:col-span-12')}>
            <div className="mb-4 border-b border-line pb-3">
              <h2 className="font-display text-xl font-bold uppercase tracking-wide text-ink">{t('pp_timeline')}</h2>
              <p className="mt-0.5 text-xs text-muted">{t('pp_timeline_sub')}</p>
            </div>
            <div className="relative pl-6 sm:pl-8">
              <span className="absolute bottom-3 left-2 top-3 w-[2px] sm:left-3" style={{ background: rail }} aria-hidden />
              <ol className="list-none space-y-3 pl-0">
                {vm.contests.map((c, i) => <ContestCard key={c.key} c={c} current={i === 0} />)}
              </ol>
            </div>
          </section>
        )}
        {vm.affidavit.length > 0 && vm.latest && <aside className="lg:col-span-4"><AffidavitTile vm={vm} /></aside>}
      </div>
    </PageShell>
  );
}
