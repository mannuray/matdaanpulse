import { useTranslation } from 'react-i18next';
import type { ReactNode } from 'react';
import type { PartyPageVM } from '../../../viewmodels/pages/usePartyPageVM';
import { PartyMark } from '../../ui/PartyMark';
import { tile, tint } from './ui';

/** Profile header: mark, name, abbreviation, recognition and the profile fields we have (missing ones left out). */
export function PartyHeader({ vm, recognition, leader, extra, aside }: {
  vm: PartyPageVM; recognition: string | null; leader: { label: string; name: string } | null; extra?: ReactNode; aside?: ReactNode;
}) {
  const { t } = useTranslation();
  const p = vm.party!;
  const facts = [
    p.founded_year != null && <span key="f">{t('pty_founded')} <strong className="font-semibold text-ink">{p.founded_year}</strong></span>,
    p.headquarters && <span key="hq">{t('pty_hq')} <strong className="font-semibold text-ink">{p.headquarters}</strong></span>,
    leader && <span key="l">{leader.label}: <strong className="font-semibold text-ink">{leader.name}</strong></span>,
    extra,
    p.website && <a key="w" href={p.website} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text hover:underline">{t('pty_website')} ↗</a>,
    p.wikipedia_url && <a key="wk" href={p.wikipedia_url} target="_blank" rel="noopener noreferrer" className="font-medium text-accent-text hover:underline">{t('pp_wikipedia')} ↗</a>,
  ].filter(Boolean);
  return (
    <header className={`${tile} relative overflow-hidden p-4 lg:p-5`}>
      <div className="pointer-events-none absolute -left-24 -top-24 h-80 w-80 rounded-full blur-3xl" style={{ background: tint(vm.color, 14) }} aria-hidden />
      <div className="relative z-10 flex flex-col gap-4 md:flex-row md:items-center">
        <span className="grid h-20 w-20 shrink-0 place-items-center rounded-2xl border border-line bg-page p-2"><PartyMark mark={vm.mark} color={vm.color} label={p.abbreviation ?? p.id} size={64} /></span>
        <div className="min-w-0 flex-1 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="font-display text-3xl font-extrabold uppercase leading-none tracking-tight text-ink sm:text-4xl">{p.name}</h1>
            {p.abbreviation && p.abbreviation !== p.name && <span className="rounded-md border px-2 py-0.5 text-xs font-bold" style={{ color: vm.color, borderColor: tint(vm.color, 40) }}>{p.abbreviation}</span>}
            {recognition && <span className="rounded-full border border-ok-text/40 px-2.5 py-0.5 text-xs font-semibold text-ok-text">{recognition}</span>}
          </div>
          {facts.length > 0 && <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">{facts}</div>}
          <p className="text-[11px] uppercase tracking-wider text-muted">{t('pty_final_only')}</p>
        </div>
        {aside}
      </div>
    </header>
  );
}
