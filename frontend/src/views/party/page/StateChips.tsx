import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PartyPageVM } from '../../../viewmodels/pages/usePartyPageVM';
import { cn } from '../../ui/cn';

/** "All states" first, then the contested states: each opens that view (shareable link). */
export function StateChips({ chips }: { chips: PartyPageVM['chips'] }) {
  const { t } = useTranslation();
  if (!chips.length) return null;
  return (
    <nav aria-label={t('pty_states')} className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:px-0">
      {chips.map(c => (
        <Link key={c.code || 'all'} to={c.href} aria-current={c.active ? 'page' : undefined}
          className={cn('shrink-0 rounded-full border px-3 py-1.5 text-sm', c.active ? 'border-accent bg-accent text-white' : 'border-line text-ink hover:border-accent')}>
          {c.code ? c.name : t('pty_all_states')}
        </Link>
      ))}
    </nav>
  );
}
