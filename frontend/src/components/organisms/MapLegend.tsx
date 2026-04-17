import React from 'react';
import type { MapTab } from '../../types';

interface LegendEntry {
  name: string;
  color: string;
}

interface MapLegendProps {
  mapTab: MapTab;
  legendEntries: LegendEntry[];
  marginBuckets: any[];
  blendWithWhite: (hex: string, intensity: number) => string;
  hasSwingData?: boolean;
  hasDominanceData?: boolean;
  spoilerData?: { hasData: boolean; spoilerSeats: Set<string>; threeWaySeats: Set<string> };
}

export const MapLegend: React.FC<MapLegendProps> = ({
  mapTab,
  legendEntries,
  marginBuckets,
  blendWithWhite,
  hasSwingData,
  hasDominanceData,
  spoilerData,
}) => {
  if (mapTab === 'states') return null;

  if (mapTab === 'insights') {
    return (
      <div className="margin-legend" style={{ flexShrink: 0, gap: 8 }}>
        {spoilerData?.hasData ? (
          <>
            <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: 'var(--accent)', backgroundImage: 'repeating-linear-gradient(45deg, transparent, transparent 1px, rgba(0,0,0,0.35) 1px, rgba(0,0,0,0.35) 2px)' }} />
              Spoiler-affected
            </span>
            <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#f59e0b' }} />
              Three-way
            </span>
            <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
              <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#e5e7eb' }} />
              Two-way
            </span>
          </>
        ) : (
          <>
            <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>Competitive</span>
            {[1.0, 0.75, 0.5, 0.25, 0].map((intensity, i) => {
              const blue = Math.round(100 + intensity * 155);
              const red = Math.round(230 - intensity * 180);
              const green = Math.round(230 - intensity * 130);
              return (
                <span key={i} className="swatch" style={{ display: 'inline-block', width: 20, height: 8, borderRadius: 1, background: `rgb(${red},${green},${blue})` }} />
              );
            })}
            <span style={{ fontSize: 9, color: 'var(--text-secondary)' }}>Safe</span>
          </>
        )}
      </div>
    );
  }

  if (mapTab === 'swing' && hasSwingData) {
    return (
      <div className="margin-legend" style={{ flexShrink: 0, gap: 8 }}>
        <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#10b981' }} />
          Flipped
        </span>
        <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#d4d4d4' }} />
          Held
        </span>
      </div>
    );
  }

  if (mapTab === 'history' && hasDominanceData) {
    return (
      <div className="margin-legend" style={{ flexShrink: 0, gap: 8 }}>
        <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#6b7280' }} />
          Stronghold
        </span>
        <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#6b7280', opacity: 0.6 }} />
          Loyal
        </span>
        <span style={{ fontSize: 9, display: 'flex', alignItems: 'center', gap: 3 }}>
          <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: '#f59e0b' }} />
          Swing
        </span>
      </div>
    );
  }

  if (legendEntries.length > 0) {
    return (
      <div className="margin-legend" style={{ flexShrink: 0 }}>
        {legendEntries.map((entry, i) => (
          <div key={entry.name} style={{ display: 'contents' }}>
            {i > 0 && <span style={{ fontSize: 8, color: 'var(--text-secondary)', margin: '0 2px' }}>|</span>}
            <span style={{ fontSize: 9, fontWeight: 700, color: entry.color, marginRight: 2 }}>{entry.name}</span>
            {(mapTab === 'battle' || mapTab === 'demographics') && marginBuckets.map((b: any) => (
              <div key={b.label} className="margin-legend-item">
                <span className="swatch" style={{ background: blendWithWhite(entry.color, b.intensity) }} />
              </div>
            ))}
            {mapTab === 'overview' && (
              <span className="swatch" style={{ display: 'inline-block', width: 12, height: 8, borderRadius: 1, background: entry.color, verticalAlign: 'middle' }} />
            )}
          </div>
        ))}
        {(mapTab === 'battle' || mapTab === 'demographics') && (
          <>
            <span style={{ fontSize: 8, color: 'var(--text-secondary)', margin: '0 2px' }}>|</span>
            {marginBuckets.map((b: any) => (
              <span key={b.label} style={{ fontSize: 8, color: 'var(--text-secondary)' }}>{b.label}</span>
            ))}
          </>
        )}
      </div>
    );
  }

  return null;
};
