import PartyIcon from '../atoms/PartyIcon';
import type { Alliance } from '../../types';

interface TallyCardProps {
  alliance: Alliance;
  total: number;
  votePct?: number;
  removable?: boolean;
  onRemove?: () => void;
}

export default function TallyCard({ alliance, votePct, removable, onRemove }: TallyCardProps) {
  const won = Number(alliance.won);
  const leading = Number(alliance.leading);

  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6, padding: '4px 8px',
      background: 'var(--bg-card)', border: '1px solid var(--border)',
      borderRadius: 'var(--radius)', marginBottom: 2,
      borderLeft: `3px solid ${alliance.color || '#6b7280'}`,
    }}>
      <PartyIcon color={alliance.color} size={12} partyId={alliance.party_id} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: 11, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {alliance.party_name}
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 0 }}>
        <span style={{ fontWeight: 700, fontSize: 13, minWidth: 18, textAlign: 'right' }}>{won}</span>
        {leading > 0 && (
          <span style={{ color: 'var(--accent)', fontSize: 9, fontWeight: 600 }}>+{leading}</span>
        )}
      </div>
      {votePct != null && (
        <span style={{ fontSize: 9, color: 'var(--text-secondary)', minWidth: 28, textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
          {votePct}%
        </span>
      )}
      {removable && (
        <button
          onClick={(e) => { e.stopPropagation(); onRemove?.(); }}
          style={{
            background: 'none', border: 'none', cursor: 'pointer', padding: '0 1px',
            color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1,
          }}
          title="Remove"
        >
          ×
        </button>
      )}
    </div>
  );
}
