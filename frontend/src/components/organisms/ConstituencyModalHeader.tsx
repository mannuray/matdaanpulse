import React from 'react';

interface ConstituencyModalHeaderProps {
  name?: string;
  constituencyId: string;
  type?: string;
  stateName?: string;
  constNo?: number;
  phase?: number;
  currentRound?: number;
  totalRounds?: number;
  onOpenFullPage?: () => void;
  onClose?: () => void;
  isPage?: boolean;
}

export const ConstituencyModalHeader: React.FC<ConstituencyModalHeaderProps> = ({
  name,
  constituencyId,
  type,
  stateName,
  constNo,
  phase,
  currentRound,
  totalRounds,
  onOpenFullPage,
  onClose,
  isPage
}) => {
  const roundPct = (currentRound && totalRounds) ? currentRound / totalRounds : 0;
  const roundColor = roundPct > 0.75 ? 'var(--success)' : roundPct < 0.33 ? 'var(--warning)' : 'var(--text-secondary)';

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', gap: '2px', padding: isPage ? 'var(--space-2) 0 var(--space-4)' : 'var(--space-3) var(--space-4)',
      borderBottom: isPage ? 'none' : '1px solid var(--border)', 
      position: isPage ? 'static' : 'sticky', top: 0,
      background: isPage ? 'transparent' : 'var(--bg-card)', zIndex: 1, 
      borderTopLeftRadius: isPage ? 0 : 'var(--radius-lg)', borderTopRightRadius: isPage ? 0 : 'var(--radius-lg)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
        <h2 style={{ fontSize: isPage ? 'var(--text-2xl)' : 'var(--text-lg)', fontWeight: 'var(--weight-bold)', margin: 0, flex: 1, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
          {name || constituencyId.replace(/_/g, ' ')}
        </h2>
        
        {currentRound != null && totalRounds != null && (
          <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '2px 8px', borderRadius: 'var(--radius-full)', fontSize: '10px', fontWeight: 'var(--weight-bold)',
            background: 'var(--bg-secondary)', border: '1px solid var(--border)', color: 'var(--text-secondary)',
          }}>
            <span style={{ color: roundColor }}>Round {currentRound}/{totalRounds}</span>
            <span style={{ width: 30, height: 3, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
              <span style={{ display: 'block', height: '100%', background: roundColor, width: `${roundPct * 100}%` }} />
            </span>
          </span>
        )}

        {onClose && (
          <button
            onClick={onClose}
            style={{
              fontSize: 20, lineHeight: 1, padding: '4px', borderRadius: 'var(--radius-sm)',
              border: 'none', background: 'transparent', color: 'var(--text-muted)', cursor: 'pointer',
              transition: 'color 0.2s'
            }}
          >×</button>
        )}
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 'var(--weight-medium)' }}>
        {stateName && <span>{stateName}</span>}
        {constNo && <span>• Seat #{constNo}</span>}
        {type && <span>• {type}</span>}
        {phase && <span style={{ color: 'var(--accent)', fontWeight: 'var(--weight-bold)' }}>• PHASE {phase}</span>}
        {onOpenFullPage && !isPage && (
          <button
            onClick={onOpenFullPage}
            style={{ marginLeft: 'auto', fontSize: '9px', color: 'var(--accent)', fontWeight: 'var(--weight-bold)', background: 'none', border: 'none', padding: 0, cursor: 'pointer' }}
          >
            VIEW FULL PAGE →
          </button>
        )}
      </div>
    </div>
  );
};
