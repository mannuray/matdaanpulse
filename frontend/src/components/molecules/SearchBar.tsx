import { useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useGlobalSearch } from '../../hooks/useGlobalSearch';
import type { Constituency, Candidate } from '../../types';

interface SearchBarProps {
  electionId?: string;
  onSelectConstituency: (c: Constituency) => void;
  onSelectCandidate: (c: Candidate) => void;
}

/**
 * MOLECULE: Search Bar (MVC: View)
 * Delegated search UI component.
 */
export default function SearchBar({ electionId, onSelectConstituency, onSelectCandidate }: SearchBarProps) {
  const { t } = useTranslation();
  const {
    query, constituencies, candidates, open, setOpen, 
    handleQueryChange, reset, hasResults 
  } = useGlobalSearch(electionId);
  
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [setOpen]);

  return (
    <div className="search-container" ref={containerRef} style={{ minWidth: 220, maxWidth: 360, flex: 1 }}>
      <svg style={styles.icon} viewBox="0 0 20 20" fill="currentColor">
        <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
      </svg>
      <input
        className="search-input"
        type="text"
        placeholder={t('search_placeholder')}
        value={query}
        onChange={(e) => handleQueryChange(e.target.value)}
        onFocus={() => { if (hasResults) setOpen(true); }}
        onKeyDown={(e) => { if (e.key === 'Escape') setOpen(false); }}
        aria-label={t('search')}
      />
      {open && hasResults && (
        <div className="search-results">
          {constituencies.length > 0 && (
            <>
              <div style={styles.sectionHeader}>{t('constituency')}</div>
              {constituencies.slice(0, 8).map((c) => (
                <div key={c.id} className="search-item" onClick={() => { onSelectConstituency(c); reset(); }}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={styles.itemMeta}>#{c.const_no} {c.district?.name || ''}</div>
                </div>
              ))}
            </>
          )}
          {candidates.length > 0 && (
            <>
              <div style={styles.sectionHeader}>{t('candidates')}</div>
              {candidates.slice(0, 8).map((c) => (
                <div key={c.id} className="search-item" onClick={() => { onSelectCandidate(c); reset(); }}>
                  <div style={{ fontWeight: 500 }}>{c.name}</div>
                  <div style={styles.itemMeta}>{c.party?.name || t('independent')}</div>
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  );
}

const styles = {
  icon: { position: 'absolute' as const, left: 10, top: '50%', transform: 'translateY(-50%)', width: 14, height: 14, color: 'var(--text-secondary)' },
  sectionHeader: { padding: '6px 12px', fontSize: 11, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase' as const },
  itemMeta: { fontSize: 11, color: 'var(--text-secondary)' }
};
