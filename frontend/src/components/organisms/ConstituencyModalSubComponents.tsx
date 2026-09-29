import React from 'react';
import type { IncumbencyEntry } from '../../types';

export interface RevisionInfo {
  netChange: number;
  pctChange: number;
  tier: string;
  tierColor: string;
}

export interface SwingBadge {
  flipped: boolean;
  fromColor?: string;
  fromLabel?: string;
  toColor?: string;
  toLabel?: string;
  holdColor?: string;
  holdLabel?: string;
}

export interface DominanceBadge {
  type: string;
  label: string;
  bgColor?: string;
}

interface ConstituencyModalStatsProps {
  totalElectors?: number;
  totalVotesPolled: number;
  voterTurnout: number | null;
  winMargin?: number;
  revisionData?: RevisionInfo | null;
  t: (key: string) => string;
}

export const ConstituencyModalStats: React.FC<ConstituencyModalStatsProps> = ({
  totalElectors, totalVotesPolled, voterTurnout, winMargin, revisionData, t
}) => (
  <div className="card" style={{ 
    padding: 0, background: 'var(--bg-secondary)', border: 'none',
    marginBottom: 'var(--space-3)', borderRadius: 'var(--radius)', overflow: 'hidden',
    width: '100%', boxSizing: 'border-box'
  }}>
    <div style={{
      display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', 
      borderBottom: revisionData ? '1px solid var(--border)' : 'none'
    }}>
      <div style={{ padding: 'var(--space-2) var(--space-3)', borderRight: '1px solid var(--border)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '9px', fontWeight: 'var(--weight-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('votes_polled')}</div>
        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)', color: 'var(--text-primary)', lineHeight: 1.2 }}>{totalVotesPolled.toLocaleString()}</div>
        {voterTurnout !== null && (
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            {voterTurnout}% {t('turnout')}
          </div>
        )}
      </div>
      
      <div style={{ padding: 'var(--space-2) var(--space-3)' }}>
        <div style={{ color: 'var(--text-secondary)', fontSize: '9px', fontWeight: 'var(--weight-semibold)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{t('margin')}</div>
        <div style={{ fontWeight: 'var(--weight-bold)', fontSize: 'var(--text-lg)', color: 'var(--success)', lineHeight: 1.2 }}>+{winMargin?.toLocaleString() || '0'}</div>
        {totalElectors != null && (
          <div style={{ fontSize: '10px', color: 'var(--text-secondary)' }}>
            of {totalElectors.toLocaleString()} electors
          </div>
        )}
      </div>
    </div>

    {revisionData && (
      <div style={{ 
        padding: '6px var(--space-3)', background: 'rgba(0,0,0,0.02)', 
        display: 'flex', justifyContent: 'space-between', alignItems: 'center' 
      }}>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center' }}>
          <span style={{ fontWeight: 'var(--weight-bold)', fontSize: '9px', textTransform: 'uppercase', color: 'var(--text-muted)' }}>Revision</span>
          <div style={{ fontSize: '10px' }}>
            <span style={{ fontWeight: 'var(--weight-bold)', color: revisionData.netChange >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              {revisionData.netChange >= 0 ? '+' : ''}{revisionData.netChange.toLocaleString()}
            </span>
            <span style={{ color: 'var(--text-secondary)', marginLeft: '2px' }}>({revisionData.pctChange.toFixed(1)}%)</span>
          </div>
        </div>
        <span style={{ 
          fontSize: '8px', padding: '1px 6px', borderRadius: 'var(--radius-full)',
          background: 'var(--bg-primary)', border: '1px solid var(--border)', 
          color: revisionData.tierColor, fontWeight: 'var(--weight-bold)', textTransform: 'uppercase'
        }}>
          {revisionData.tier} IMPACT
        </span>
      </div>
    )}
  </div>
);

interface ConstituencyModalInsightsProps {
  badges: {
    swing?: SwingBadge | null;
    dominance?: DominanceBadge | null;
    isVip?: boolean;
    manualTags?: string[];
  };
  seatType?: string;
  incumbencyEntry?: IncumbencyEntry;
  totalVotesPolled: number;
}

export const ConstituencyModalInsights: React.FC<ConstituencyModalInsightsProps> = ({
  badges, seatType, incumbencyEntry, totalVotesPolled
}) => (
  <div style={{
    display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', marginBottom: 'var(--space-4)',
    paddingBottom: 'var(--space-1)'
  }}>
    {/* VIP Badge - Priority */}
    {badges.isVip && (
      <span className="badge badge-vip" style={{ fontSize: '10px', height: '24px', padding: '0 10px', borderRadius: 'var(--radius-full)' }}>
        VIP SEAT
      </span>
    )}

    {/* Swing Badge - HERO */}
    {badges.swing && (
      <span className="battle-chip selected" style={{ 
        background: badges.swing.flipped ? 'var(--danger-soft)' : 'var(--success-soft)', 
        color: badges.swing.flipped ? 'var(--danger-text)' : 'var(--success-text)', 
        border: 'none', padding: '4px 10px', height: '24px', fontSize: '10px'
      }}>
        <span style={{ width: 6, height: 6, borderRadius: '50%', background: badges.swing.flipped ? badges.swing.fromColor : badges.swing.holdColor }} />
        {badges.swing.flipped ? (
          <>
            <span style={{ opacity: 0.8 }}>{badges.swing.fromLabel}</span>
            <span style={{ opacity: 0.5 }}>→</span>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: badges.swing.toColor }} />
            <span style={{ fontWeight: 'var(--weight-bold)' }}>{badges.swing.toLabel}</span>
            <span style={{ fontWeight: 'var(--weight-bold)', marginLeft: '4px', paddingLeft: '4px', borderLeft: '1px solid currentColor' }}>GAIN</span>
          </>
        ) : (
          <>
            <span style={{ fontWeight: 'var(--weight-bold)' }}>{badges.swing.holdLabel}</span>
            <span style={{ fontWeight: 'var(--weight-bold)', marginLeft: '4px', paddingLeft: '4px', borderLeft: '1px solid currentColor' }}>RETAINED</span>
          </>
        )}
      </span>
    )}

    {/* Secondary Insights - Ghosted */}
    <div style={{ display: 'flex', gap: 'var(--space-1)', flexWrap: 'wrap', opacity: 0.8 }}>
      {badges.dominance && (
        <span className="battle-chip" style={{ 
          background: badges.dominance.type === 'stronghold' ? 'var(--success-soft)' : 'var(--bg-primary)', 
          color: badges.dominance.type === 'stronghold' ? 'var(--success-text)' : 'var(--text-secondary)', 
          border: '1px solid var(--border)', 
          padding: '2px 8px', height: '24px', fontSize: '10px'
        }}>
          <span style={{ width: 6, height: 6, borderRadius: '50%', background: badges.dominance.bgColor, opacity: 0.6 }} />
          <span>{badges.dominance.label}</span>
        </span>
      )}

      {/* Manual Tags */}
      {(badges.manualTags || []).map(tag => (
        <span key={tag} className="battle-chip" style={{ 
          background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', 
          padding: '2px 8px', height: '24px', fontSize: '10px', textTransform: 'uppercase'
        }}>
          {tag.replace(/_/g, ' ')}
        </span>
      ))}

      {incumbencyEntry && incumbencyEntry.incumbentName && (() => {
        const noResults = totalVotesPolled === 0;
        return (
          <span className="battle-chip" style={{ 
            background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', 
            padding: '2px 8px', height: '24px', fontSize: '10px'
          }}>
            <span style={{ opacity: 0.7 }}>Incumbent</span>
            <span style={{ fontWeight: 'var(--weight-bold)', margin: '0 3px' }}>{incumbencyEntry.incumbentName.split(' ').slice(0, 2).join(' ')}</span>
            <span style={{ opacity: 0.7 }}>{noResults ? 'Contesting' : incumbencyEntry.won ? 'Retained' : 'Lost'}</span>
          </span>
        );
      })()}

      {seatType && (
        <span className="battle-chip" style={{ 
          background: 'var(--bg-primary)', color: 'var(--text-secondary)', border: '1px solid var(--border)', 
          padding: '2px 8px', height: '24px', fontSize: '10px'
        }}>
          {seatType === 'three-way' ? 'Three-way' : seatType === 'multi-cornered' ? 'Multi-corner' : 'Two-way'}
        </span>
      )}
    </div>
  </div>
);
