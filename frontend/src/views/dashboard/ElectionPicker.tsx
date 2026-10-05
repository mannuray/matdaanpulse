import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';
import { useTranslation } from 'react-i18next';
import type { TopBarVM } from '../../viewmodels/tiles/useTopBarVM';
import { cn } from '../ui/cn';

const STATUS_DOT = { Live: 'bg-live animate-pulse', Upcoming: 'bg-warn', Finalized: '' } as const;

/**
 * The election list shared by the desktop popover and the phone sheet: a search box, live/upcoming elections pinned, then
 * one row per state (alphabetical) with its years as chips. Picking a year calls `onPicked` after `vm.onElection`.
 */
export function ElectionChoicesList({ vm, onPicked }: { vm: TopBarVM; onPicked(): void }) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');
  const { pinned, rows } = vm.choices(query);
  const pick = (id: string) => { vm.onElection(id); onPicked(); };
  return (
    <div className="flex flex-col gap-3">
      <input type="search" value={query} onChange={e => setQuery(e.target.value)} aria-label={t('studio_picker_search')} placeholder={t('studio_picker_search')}
        className="h-11 w-full rounded-xl border border-line bg-page/60 px-3 text-sm text-ink outline-none placeholder:text-muted focus-visible:ring-2 focus-visible:ring-accent" />
      {pinned.length > 0 && (
        <section className="flex flex-col gap-1 border-b border-line pb-3">
          <h3 className="text-xs font-medium uppercase tracking-wider text-muted">{t('studio_picker_pinned')}</h3>
          {pinned.map(p => (
            <button key={p.id} type="button" onClick={() => pick(p.id)} aria-label={`${p.stateName} ${p.year} · ${t(`studio_picker_${p.status === 'Live' ? 'live' : 'upcoming'}`)}`}
              className="flex min-h-11 items-center gap-2 rounded-xl px-2 text-left text-sm hover:bg-tile-raised focus-visible:ring-2 focus-visible:ring-accent">
              <span aria-hidden className={cn('h-2 w-2 shrink-0 rounded-full', STATUS_DOT[p.status])} />
              <span className="flex-1 font-medium text-ink">{p.stateName} · {p.year}</span>
              <span className="text-xs text-muted">{t(`studio_picker_${p.status === 'Live' ? 'live' : 'upcoming'}`)}</span>
            </button>
          ))}
        </section>
      )}
      {rows.length === 0 && <p className="py-6 text-center text-sm text-muted">{t('studio_picker_none', { query })}</p>}
      {rows.map(r => (
        <div key={r.stateId} role="group" aria-label={r.name} className="flex flex-col gap-1.5 sm:flex-row sm:items-center sm:gap-3">
          <span className="text-sm font-medium text-ink sm:w-28 sm:shrink-0">{r.name}</span>
          <div className="flex flex-wrap gap-1.5">
            {r.elections.map(e => {
              const current = e.id === vm.electionId;
              return (
                <button key={e.id} type="button" onClick={() => pick(e.id)} aria-label={`${r.name} ${e.year}`} aria-current={current ? 'true' : undefined} data-current-election={current || undefined}
                  className={cn('inline-flex h-10 min-w-[3.5rem] items-center justify-center gap-1.5 rounded-full border px-3 text-sm font-medium tabular-nums focus-visible:ring-2 focus-visible:ring-accent sm:h-8',
                    current ? 'border-accent bg-accent text-white' : 'border-line text-ink hover:border-accent')}>
                  {e.status !== 'Finalized' && <span aria-hidden className={cn('h-1.5 w-1.5 rounded-full', STATUS_DOT[e.status])} />}
                  {e.year}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

/** Desktop: one button in the top bar opening the list in a popover (search box focused). */
export function ElectionPickerPopover({ vm, children }: { vm: TopBarVM; children?: React.ReactNode }) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger aria-label={t('studio_election_picker_current', { label: vm.electionLabel })} data-election-chip
        className="flex h-9 min-w-0 shrink-0 items-center gap-1.5 rounded-full border border-line px-3 text-sm font-medium text-ink hover:border-accent focus-visible:ring-2 focus-visible:ring-accent">
        <span className="truncate">{vm.electionLabel}</span><span aria-hidden className="text-muted">▾</span>
      </Popover.Trigger>
      <Popover.Portal>
        <Popover.Content align="start" sideOffset={6} aria-label={t('studio_election_picker')}
          onOpenAutoFocus={e => { e.preventDefault(); (e.currentTarget as HTMLElement).querySelector<HTMLElement>('input[type=search]')?.focus(); }}
          className="studio-root z-50 flex max-h-[70vh] w-[500px] max-w-[calc(100vw-2rem)] flex-col gap-3 overflow-y-auto rounded-tile border border-line bg-tile p-3 shadow-xl outline-none">
          {children}
          <ElectionChoicesList vm={vm} onPicked={() => setOpen(false)} />
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
