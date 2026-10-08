import { useTranslation } from 'react-i18next';
import type { LineageEvent } from '../../../viewmodels/pages/usePartyPageVM';
import { heading, tile } from './ui';

/** The party family's renames, mergers, splits and breakaways, oldest first, each with its source. */
export function LineageCard({ events, nameOf }: { events: LineageEvent[]; nameOf(id: string): string }) {
  const { t } = useTranslation();
  if (!events.length) return null;
  return (
    <section className={`${tile} p-4`} aria-label={t('pty_lineage')}>
      <h2 className={`${heading} mb-3`}>{t('pty_lineage')}</h2>
      <ol className="ml-2 list-none border-l border-line p-0">
        {events.map((e, i) => (
          <li key={i} className="relative mb-3 pl-4">
            <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-accent" aria-hidden />
            <p className="text-sm text-ink">
              <span className="tabular mr-2 text-muted">{e.effective_date.slice(0, 4)}</span>
              {t(`pty_event_${e.kind}`, { from: nameOf(e.predecessor_id), to: nameOf(e.party_id) })}
            </p>
            {e.note && <p className="text-xs text-muted">{e.note}</p>}
            {e.source_url && <a href={e.source_url} target="_blank" rel="noopener noreferrer" className="text-xs text-accent-text hover:underline">{t('pty_source')} ↗</a>}
          </li>
        ))}
      </ol>
    </section>
  );
}
