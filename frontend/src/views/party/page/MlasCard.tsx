import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import type { PartyStateView } from '../../../viewmodels/pages/usePartyPageVM';
import type { MlaSearchVM } from '../../../viewmodels/pages/useMlaSearch';
import { Avatar } from '../../ui/Avatar';
import { formatIN } from '../../ui/format';
import { heading, tile } from './ui';

/** The latest election's winners, all listed (no expanders), with a search box. */
export function MlasCard({ sv, search }: { sv: PartyStateView; search: MlaSearchVM }) {
  const { t } = useTranslation();
  if (!sv.mlas.length) return null;
  return (
    <section id="pty-mlas" className={`${tile} scroll-mt-28 p-4`} aria-label={t('pty_mlas')}>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className={heading}>{t('pty_mlas')} <span className="tabular text-sm text-muted">{sv.mlas.length}</span></h2>
        <input type="search" value={search.query} onChange={e => search.setQuery(e.target.value)} placeholder={t('pty_search_mlas', { count: sv.mlas.length })} aria-label={t('pty_search_mlas', { count: sv.mlas.length })}
          className="w-full rounded-full border border-line bg-page px-3 py-1.5 text-sm text-ink sm:w-64" />
      </div>
      <ul className="m-0 grid list-none gap-2 p-0 sm:grid-cols-2">
        {search.filtered.map(m => (
          <li key={m.constId} className="flex items-center gap-3 rounded-xl border border-line bg-page/50 p-2.5">
            <Avatar name={m.name} photo={m.photo} size={36} />
            <div className="min-w-0 flex-1">
              {m.personId ? <Link to={`/person/${m.personId}`} className="block truncate font-semibold text-ink hover:underline">{m.name}</Link> : <span className="block truncate font-semibold text-ink">{m.name}</span>}
              <Link to={`/election/${sv.electionId}/constituency/${m.constId}`} className="text-xs text-muted hover:underline">{m.constName}</Link>
            </div>
            {m.margin != null && <span className="tabular text-xs font-semibold text-ok-text">+{formatIN(m.margin)}</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}
