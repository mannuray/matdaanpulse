import PartyIcon from '../atoms/PartyIcon';

interface MapTooltipProps {
  x: number;
  y: number;
  name: string;
  candidate?: string;
  party?: string;
  partyColor?: string;
  margin?: number;
  status?: string;
  visible: boolean;
}

export default function MapTooltip({ x, y, name, candidate, party, partyColor, margin, status, visible }: MapTooltipProps) {
  if (!visible) return null;
  return (
    <div
      role="tooltip"
      style={{
        position: 'fixed', left: x + 14, top: y - 12,
        padding: '6px 10px',
        background: 'var(--bg-card)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius)', fontSize: 12, pointerEvents: 'none', zIndex: 100,
        boxShadow: 'var(--shadow-lg)', maxWidth: 240,
        borderLeft: partyColor ? `3px solid ${partyColor}` : undefined,
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 13, marginBottom: 2 }}>{name}</div>
      {candidate && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
            <PartyIcon color={partyColor || null} size={14} partyId={party} />
            <span style={{ fontSize: 11, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{candidate}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 5, marginTop: 3 }}>
            <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>{party}</span>
            {status && (
              <span style={{
                padding: '1px 5px', borderRadius: 8, fontSize: 9, fontWeight: 700, color: '#fff',
                background: status === 'WON' ? '#10b981' : status === 'LEADING' ? '#3b82f6' : '#9ca3af',
              }}>
                {status}
              </span>
            )}
            {margin !== undefined && margin > 0 && (
              <span style={{ fontSize: 11, fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>
                +{margin.toLocaleString()}
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
