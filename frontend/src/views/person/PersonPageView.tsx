import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PersonPageVM } from '../../viewmodels/pages/usePersonPageVM';
import { PageShell } from '../page/PageShell';
import { PartyMark } from '../ui/PartyMark';
import { Avatar } from '../ui/Avatar';
import { formatIN, formatRupees } from '../ui/format';
import { STATUS_STYLE } from '../dashboard/statusStyle';
import { AffidavitChart } from './AffidavitChart';
import { cn } from '../ui/cn';

const tile = 'rounded-tile border border-line bg-tile p-4';
const h2 = 'mb-3 font-display text-sm font-bold uppercase tracking-wider text-ink';

export function PersonPageView({ vm }: { vm: PersonPageVM }) {
  const { t } = useTranslation();
  const back = { href: '/', label: t('back') };
  if (vm.status !== 'ready') {
    return <PageShell back={back}><p className="py-16 text-center text-muted">{vm.status === 'notFound' ? t('pp_not_found') : vm.status === 'error' ? t('error_occurred') : t('loading')}</p></PageShell>;
  }
  const g = vm.facts.gender;
  const facts = [
    vm.facts.age != null ? t('pp_age', { n: vm.facts.age }) : null,
    g ? (g.labelKey ? t(g.labelKey) : g.raw) : null,
    vm.facts.education, vm.facts.home,
  ].filter(Boolean) as string[];
  const lastSwitch = vm.stats.switches[vm.stats.switches.length - 1];
  const statTiles: { label: string; value: string; sub?: string }[] = [
    { label: t('pp_contests'), value: String(vm.stats.contests) },
    { label: t('pp_wins'), value: String(vm.stats.wins) },
    ...(vm.stats.winRate != null ? [{ label: t('pp_win_rate'), value: `${vm.stats.winRate}%` }] : []),
    { label: t('pp_parties'), value: String(vm.stats.parties.length), sub: lastSwitch ? t('pp_switch', { from: lastSwitch.fromLabel, to: lastSwitch.toLabel, year: lastSwitch.year }) : undefined },
  ];
  const latest = vm.latest;
  return (
    <PageShell back={back}>
      <header className="flex flex-col gap-4 border-b border-line pb-4 sm:flex-row sm:items-start">
        <div className="relative shrink-0 self-start">
          <Avatar name={vm.name} photo={vm.photo} size={128} className="text-3xl" />
          {vm.currentParty && <span className="absolute -bottom-1 -right-1 rounded-full border border-line bg-page p-1"><PartyMark mark={vm.currentParty.mark} color={vm.currentParty.color} label={vm.currentParty.label} size={24} /></span>}
        </div>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="font-display text-4xl font-bold uppercase lg:text-5xl">{vm.name}</h1>
            {vm.incumbent && <span className="rounded-full border border-accent/50 px-2 py-0.5 text-xs text-accent">{t('seat_incumbent')}</span>}
          </div>
          {vm.currentParty && <div className="mt-1 text-sm font-semibold text-muted">{vm.currentParty.label}</div>}
          {facts.length > 0 && <p className="mt-2 text-sm text-muted">{facts.join(' · ')}</p>}
          {vm.wikipedia && <a href={vm.wikipedia} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block text-sm text-accent-text hover:underline">{t('pp_wikipedia')} ↗</a>}
          {vm.bio && <p className="mt-3 max-w-3xl whitespace-pre-line text-sm leading-relaxed">{vm.bio}</p>}
        </div>
      </header>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {statTiles.map(s => (
          <div key={s.label} className={tile}>
            <div className="text-[11px] uppercase tracking-wider text-muted">{s.label}</div>
            <div className="tabular font-display text-3xl font-bold">{s.value}</div>
            {s.sub && <div className="mt-1 text-xs text-muted">{s.sub}</div>}
          </div>
        ))}
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        {vm.contests.length > 0 && (
          <section>
            <h2 className={h2}>{t('pp_timeline')}</h2>
            <ol className="flex list-none flex-col gap-2 pl-0">
              {vm.contests.map(c => (
                <li key={c.key} className={cn(tile, 'relative hover:border-accent/60')}>
                  {/* The card link is stretched over the card; the party link sits above it, outside the card's <a>. */}
                  <Link to={c.constHref} aria-label={`${c.electionName} · ${c.constituency}`} className="absolute inset-0 rounded-tile" />
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-display font-bold">{c.electionName} · {c.constituency}</div>
                      {c.partyHref && <Link to={c.partyHref} className="relative z-10 mt-1 inline-flex items-center gap-1.5 text-sm text-muted hover:text-ink hover:underline"><PartyMark mark={c.mark} color={c.color} label={c.partyLabel} />{c.partyLabel}</Link>}
                    </div>
                    <span className={cn('shrink-0 rounded-md px-1.5 py-0.5 text-[11px] font-bold', STATUS_STYLE[c.status])}>{t(`studio_status_${c.status.toLowerCase()}`)}</span>
                  </div>
                  <div className="tabular mt-2 flex flex-wrap gap-x-4 text-sm">
                    <span className="font-semibold">{formatIN(c.votes)}</span>
                    {c.share != null && <span style={{ color: c.color }}>{c.share}%</span>}
                    {c.margin != null && <span className="text-muted">{t('seat_margin')} {formatIN(c.margin)}</span>}
                  </div>
                  {c.firstUnderParty && <div className="mt-1 text-xs text-warn-text">{t('pp_first_under', { party: c.partyLabel })}</div>}
                </li>
              ))}
            </ol>
          </section>
        )}
        {vm.affidavit.length > 0 && latest && (
          <section className={cn(tile, 'self-start')}>
            <h2 className={h2}>{t('pp_affidavit')}</h2>
            <dl className="grid grid-cols-2 gap-3">
              {latest.assets != null && <div><dt className="text-[11px] uppercase tracking-wider text-muted">{t('pp_latest_assets')}</dt><dd className="tabular font-display text-xl font-bold">{formatRupees(latest.assets)}</dd></div>}
              {latest.liabilities != null && <div><dt className="text-[11px] uppercase tracking-wider text-muted">{t('pp_latest_liabilities')}</dt><dd className="tabular font-display text-xl font-bold">{formatRupees(latest.liabilities)}</dd></div>}
            </dl>
            {latest.criminalCases != null && (
              <p className="mt-3 text-sm"><span className="text-muted">{t('cp_criminal_cases')} </span>
                {latest.criminalCases > 0 ? <span className="rounded-md bg-warn/15 px-1.5 py-0.5 text-xs font-bold text-warn-text">{latest.criminalCases}</span> : <span className="text-muted">0</span>}</p>
            )}
            <div className="mt-3"><AffidavitChart points={vm.affidavit} label={t('pp_affidavit')} /></div>
            <div className="mt-2 flex gap-4 text-xs text-muted">
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-accent" />{t('pp_assets')}</span>
              <span className="flex items-center gap-1.5"><span className="h-2 w-2 rounded-sm bg-live" />{t('pp_liabilities')}</span>
            </div>
            <ul className="mt-3 divide-y divide-line text-sm">
              {[...vm.affidavit].reverse().map((p, i) => (
                <li key={`${p.year}-${i}`} className="flex justify-between gap-2 py-1.5"><span className="font-semibold">{p.year}</span>
                  <span className="tabular text-muted">{[formatRupees(p.assets), p.liabilities != null ? `− ${formatRupees(p.liabilities)}` : null].filter(Boolean).join(' / ')}</span></li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </PageShell>
  );
}
