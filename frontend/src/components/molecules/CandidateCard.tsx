import { memo } from 'react';
import PartyIcon from '../atoms/PartyIcon';
import StatusBadge from '../atoms/StatusBadge';

interface CandidateCardProps {
  name: string;
  partyId?: string;
  partyColor?: string | null;
  status: string;
  votes: number;
  voteShare?: number | null;
  margin: number;
  rank: number;
  isIncumbent?: boolean;
  personId?: string | null;
  photoUrl?: string | null;
  isSplitter?: boolean;
  onPersonClick?: (personId: string) => void;
  hideResults?: boolean;
}

/**
 * MOLECULE: Candidate Card (SOLID: ISP)
 * Refactored to accept granular props instead of a monolithic object.
 */
const CandidateCard = memo(function CandidateCard({ 
  name, partyId, partyColor, status, votes, voteShare, margin, 
  rank, isIncumbent, personId, photoUrl, isSplitter, onPersonClick, hideResults 
}: CandidateCardProps) {
  const isWinner = status === 'WON' || status === 'LEADING';

  return (
    <div
      style={{
        display: 'flex', 
        alignItems: 'center', 
        gap: 8, 
        padding: '6px 12px',
        background: isWinner ? 'var(--success-soft)' : 'transparent',
        borderBottom: '1px solid var(--border)',
        transition: 'background 0.2s',
      }}
      className="candidate-row-hover"
    >
      {/* Rank & Photo/Icon */}
      <span style={styles.rank}>
        {rank}
      </span>
      
      <div style={styles.iconWrapper}>
        {photoUrl ? (
          <img
            src={photoUrl}
            alt=""
            style={styles.photo}
          />
        ) : (
          <PartyIcon color={partyColor ?? null} size={14} partyId={partyId} />
        )}
        {isWinner && <div style={styles.winnerIndicator} />}
      </div>

      {/* Name & Party - Compact Inline */}
      <div style={styles.infoWrapper}>
        <div 
          onClick={() => personId && onPersonClick?.(personId)}
          style={{ 
            ...styles.name,
            cursor: personId ? 'pointer' : 'default',
          }}
        >
          {name}
        </div>
        
        <div style={styles.partyWrapper}>
          <span style={{ opacity: 0.5 }}>•</span>
          {partyId || 'IND'}
          {isIncumbent && (
            <span style={styles.incumbencyBadge}>
              (INC)
            </span>
          )}
          {isSplitter && (
            <span style={styles.splitterBadge}>
              SPLITTER
            </span>
          )}
        </div>
      </div>

      {/* Data Columns */}
      {!hideResults && (
        <div style={styles.dataWrapper}>
          <div style={{ textAlign: 'right', width: 60 }}>
            <div style={styles.votes}>
              {votes.toLocaleString()}
            </div>
            <div style={styles.share}>
              {voteShare != null ? `${voteShare.toFixed(1)}%` : '0%'}
            </div>
          </div>

          <div style={{ width: 45, display: 'flex', justifyContent: 'center' }}>
            <StatusBadge status={status || 'TRAILING'} />
          </div>

          <div style={{ width: 70, textAlign: 'right' }}>
            <div style={{ 
              ...styles.margin,
              color: isWinner ? 'var(--success)' : 'var(--text-primary)'
            }}>
              {margin > 0 ? `+${margin.toLocaleString()}` : margin < 0 ? margin.toLocaleString() : '—'}
            </div>
            <div style={styles.marginLabel}>
              MARGIN
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

export default CandidateCard;

const styles = {
  rank: { width: 16, textAlign: 'center' as const, fontSize: '10px', fontWeight: 800, color: 'var(--text-muted)', flexShrink: 0 },
  iconWrapper: { position: 'relative' as const, width: 20, height: 20, flexShrink: 0 },
  photo: { width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' as const },
  winnerIndicator: { position: 'absolute' as const, bottom: -2, right: -2, width: 8, height: 8, background: 'var(--success)', borderRadius: '50%', border: '1px solid #fff' },
  infoWrapper: { flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 8 },
  name: { fontWeight: 700, fontSize: '12px', whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', color: 'var(--text-primary)', flex: '0 1 auto' },
  partyWrapper: { fontSize: '10px', color: 'var(--text-muted)', fontWeight: 600, whiteSpace: 'nowrap' as const, overflow: 'hidden', textOverflow: 'ellipsis', flex: '1 1 auto', display: 'flex', alignItems: 'center', gap: 4 },
  incumbencyBadge: { fontSize: '8px', color: 'var(--warning-text)', fontWeight: 800, textTransform: 'uppercase' as const },
  splitterBadge: { fontSize: '8px', color: '#fff', background: 'var(--danger)', fontWeight: 800, textTransform: 'uppercase' as const, padding: '1px 4px', borderRadius: '2px', marginLeft: 4 },
  dataWrapper: { display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 },

  votes: { fontWeight: 800, fontSize: '12px', fontVariantNumeric: 'tabular-nums', color: 'var(--text-primary)' },
  share: { fontSize: '9px', color: 'var(--text-muted)', fontWeight: 700, fontVariantNumeric: 'tabular-nums' },
  margin: { fontSize: '11px', fontWeight: 800, fontVariantNumeric: 'tabular-nums' },
  marginLabel: { fontSize: '8px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase' as const }
};
