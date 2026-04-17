import { useTranslation } from 'react-i18next';
import CandidateCard from '../molecules/CandidateCard';
import type { CandidateResult } from '../../types';

interface CandidateTableProps {
  candidates: CandidateResult[];
  onPersonClick?: (personId: string) => void;
  hideResults?: boolean;
}

/**
 * ORGANISM: Candidate Table (SOLID: ISP)
 * Orchestrates CandidateCards by providing specific data fields.
 */
export default function CandidateTable({ candidates, onPersonClick, hideResults }: CandidateTableProps) {
  const { t } = useTranslation();

  return (
    <div style={{ width: '100%', overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
      <div style={{ minWidth: 480 }}>
        <span style={styles.header}>
          {t('candidates')} ({candidates.length})
        </span>
        {candidates.map((c, i) => (
          <CandidateCard 
            key={c.id} 
            rank={i + 1}
            name={c.name}
            partyId={c.party?.id}
            partyColor={c.party?.color}
            status={c.status || 'TRAILING'}
            votes={c.votes}
            voteShare={c.vote_share}
            margin={c.margin}
            isIncumbent={c.is_incumbent}
            personId={c.person?.id}
            photoUrl={c.person?.photo_url}
            isSplitter={c.isSplitter}
            onPersonClick={onPersonClick} 
            hideResults={hideResults} 
          />
        ))}
      </div>
    </div>
  );
}

const styles = {
  header: { 
    fontSize: 'var(--text-xs)', 
    fontWeight: 'var(--weight-semibold)', 
    color: 'var(--text-secondary)', 
    display: 'block', 
    marginBottom: 'var(--space-1)', 
    textTransform: 'uppercase' as const, 
    letterSpacing: '0.02em',
    padding: '0 12px'
  }
};
