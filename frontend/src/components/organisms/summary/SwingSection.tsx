import { useMemo } from 'react';
import type { Region, AllianceDef, SwingEntry , TFunc } from './types';
import { Section, formatMargin } from './utils';

interface SwingSectionProps {
  regions: Region[];
  alliances: AllianceDef[];
  swingMap?: Map<string, SwingEntry>;
  t: TFunc;
}

export default function SwingSection({ regions: _regions, alliances, swingMap, t: _t }: SwingSectionProps) {
  const swingStats = useMemo(() => {
    if (!swingMap || swingMap.size === 0) return null;
    const partyToAlliance = new Map<string, { id: string; name: string; color: string }>();
    for (const a of alliances) {
      for (const pid of a.parties) {
        partyToAlliance.set(pid, { id: a.id, name: a.name, color: a.color });
      }
    }

    // Flips by alliance
    const gains = new Map<string, number>(); // alliance gained
    const losses = new Map<string, number>(); // alliance lost
    const flippedSeats: { constId: string; from: string; fromColor: string; to: string; toColor: string; margin: number }[] = [];

    for (const [, swing] of swingMap) {
      if (!swing.flipped) continue;
      const prevAl = partyToAlliance.get(swing.prevParty);
      const currAl = partyToAlliance.get(swing.currentParty);
      const fromKey = prevAl?.id || swing.prevParty;
      const toKey = currAl?.id || swing.currentParty;
      const fromColor = prevAl?.color || '#6b7280';
      const toColor = currAl?.color || '#6b7280';
      losses.set(fromKey, (losses.get(fromKey) || 0) + 1);
      gains.set(toKey, (gains.get(toKey) || 0) + 1);
      flippedSeats.push({
        constId: swing.constId,
        from: prevAl?.name || swing.prevParty,
        fromColor,
        to: currAl?.name || swing.currentParty,
        toColor,
        margin: swing.currentMargin,
      });
    }

    flippedSeats.sort((a, b) => a.margin - b.margin);

    // Net swing by alliance
    const allKeys = new Set([...gains.keys(), ...losses.keys()]);
    const netSwing: { name: string; color: string; gained: number; lost: number; net: number }[] = [];
    for (const key of allKeys) {
      const al = alliances.find((a) => a.id === key);
      netSwing.push({
        name: al?.name || key,
        color: al?.color || '#6b7280',
        gained: gains.get(key) || 0,
        lost: losses.get(key) || 0,
        net: (gains.get(key) || 0) - (losses.get(key) || 0),
      });
    }
    netSwing.sort((a, b) => b.net - a.net);

    return { flippedSeats, netSwing, totalFlips: flippedSeats.length };
  }, [swingMap, alliances]);

  if (!swingStats) {
    return <p className="es-hint">No comparison data available</p>;
  }

  return (
    <>
      <Section label={`Flipped Seats (${swingStats.totalFlips})`} defaultOpen>
        {swingStats.totalFlips === 0 ? (
          <p className="es-hint">No seats flipped between elections</p>
        ) : (
          <table className="es-table">
            <tbody>
              {swingStats.flippedSeats.slice(0, 15).map((s, i) => {
                const shortName = s.constId.replace(/^[A-Z]{2}_(?:VS\d*_)?(?:\d+_)?/, '').replace(/_/g, ' ');
                return (
                  <tr key={s.constId}>
                    <td className="es-rank">{i + 1}</td>
                    <td>
                      <span className="es-dot" style={{ background: s.fromColor }} />
                      <span style={{ fontSize: 10, margin: '0 2px' }}>&rarr;</span>
                      <span className="es-dot" style={{ background: s.toColor }} />
                    </td>
                    <td className="es-name">{shortName}</td>
                    <td className="es-margin">{formatMargin(s.margin)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </Section>

      {swingStats.netSwing.length > 0 && (
        <Section label="Net Swing by Alliance" defaultOpen>
          <table className="es-table">
            <thead>
              <tr>
                <th></th>
                <th>Gained</th>
                <th>Lost</th>
                <th style={{ textAlign: 'right' }}>Net</th>
              </tr>
            </thead>
            <tbody>
              {swingStats.netSwing.map(ns => (
                <tr key={ns.name}>
                  <td><span className="es-dot" style={{ background: ns.color }} /> <span className="es-name">{ns.name}</span></td>
                  <td style={{ textAlign: 'center', color: 'var(--success)', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-semibold)' }}>+{ns.gained}</td>
                  <td style={{ textAlign: 'center', color: 'var(--danger)', fontVariantNumeric: 'tabular-nums', fontWeight: 'var(--weight-semibold)' }}>-{ns.lost}</td>
                  <td style={{ textAlign: 'right', fontWeight: 'var(--weight-bold)', fontVariantNumeric: 'tabular-nums', color: ns.net > 0 ? 'var(--success)' : ns.net < 0 ? 'var(--danger)' : 'var(--text-secondary)' }}>
                    {ns.net > 0 ? '+' : ''}{ns.net}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
      )}
    </>
  );
}
