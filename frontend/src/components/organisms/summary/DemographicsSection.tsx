import { useMemo } from 'react';
import type { Region, AllianceDef, MapTab , TFunc } from './types';
import { Section, formatMargin } from './utils';

interface DemographicsSectionProps {
  regions: Region[];
  alliances: AllianceDef[];
  mapTab: MapTab;
  t: TFunc;
}

export default function DemographicsSection({ regions, alliances, mapTab, t }: DemographicsSectionProps) {
  const categoryBreakdown = useMemo(() => {
    if (mapTab !== 'demographics') return { GEN: 0, SC: 0, ST: 0, total: 0 };
    let gen = 0, sc = 0, st = 0;
    for (const r of regions) {
      if (r.type === 'SC') sc++;
      else if (r.type === 'ST') st++;
      else gen++;
    }
    return { GEN: gen, SC: sc, ST: st, total: gen + sc + st };
  }, [mapTab, regions]);

  const partyToAlliance = useMemo(() => {
    const map = new Map<string, { id: string; name: string; color: string }>();
    for (const a of alliances) {
      for (const pid of a.parties) {
        map.set(pid, { id: a.id, name: a.name, color: a.color });
      }
    }
    return map;
  }, [alliances]);

  const allianceCategoryWins = useMemo(() => {
    if (mapTab !== 'demographics') return [];
    const allianceMap = new Map<string, { name: string; color: string; GEN: number; SC: number; ST: number; total: number }>();
    for (const r of regions) {
      if (!r.party || r.margin == null) continue;
      const al = partyToAlliance.get(r.party);
      if (!al) continue;
      if (!allianceMap.has(al.id)) {
        allianceMap.set(al.id, { name: al.name, color: al.color, GEN: 0, SC: 0, ST: 0, total: 0 });
      }
      const entry = allianceMap.get(al.id)!;
      const cat = r.type || 'GEN';
      entry[cat]++;
      entry.total++;
    }
    return Array.from(allianceMap.values()).sort((a, b) => b.total - a.total);
  }, [mapTab, regions, partyToAlliance]);

  const allianceMarginByCategory = useMemo(() => {
    if (mapTab !== 'demographics') return [];
    const map = new Map<string, { name: string; color: string; GEN: { sum: number; n: number }; SC: { sum: number; n: number }; ST: { sum: number; n: number } }>();
    for (const r of regions) {
      if (r.margin == null || !r.party) continue;
      const al = partyToAlliance.get(r.party);
      if (!al) continue;
      if (!map.has(al.id)) {
        map.set(al.id, { name: al.name, color: al.color, GEN: { sum: 0, n: 0 }, SC: { sum: 0, n: 0 }, ST: { sum: 0, n: 0 } });
      }
      const entry = map.get(al.id)!;
      const cat = r.type || 'GEN';
      entry[cat].sum += r.margin;
      entry[cat].n++;
    }
    return Array.from(map.values())
      .map(e => ({
        name: e.name,
        color: e.color,
        GEN: e.GEN.n > 0 ? Math.round(e.GEN.sum / e.GEN.n) : 0,
        SC: e.SC.n > 0 ? Math.round(e.SC.sum / e.SC.n) : 0,
        ST: e.ST.n > 0 ? Math.round(e.ST.sum / e.ST.n) : 0,
      }))
      .sort((a, b) => (b.GEN + b.SC + b.ST) - (a.GEN + a.SC + a.ST));
  }, [mapTab, regions, partyToAlliance]);

  return (
    <>
      <Section label={t('category_breakdown', 'Category Breakdown')} defaultOpen>
        <div className="es-vbar-group">
          {(['GEN', 'SC', 'ST'] as const).map(cat => {
            const count = categoryBreakdown[cat];
            const maxCount = Math.max(categoryBreakdown.GEN, categoryBreakdown.SC, categoryBreakdown.ST, 1);
            return (
              <div key={cat} className="es-vbar-col">
                <span className="es-vbar-value">{count}</span>
                <div className="es-vbar-track">
                  <div className="es-vbar-fill" style={{ height: `${(count / maxCount) * 100}%` }} />
                </div>
                <span className="es-vbar-label">{cat}</span>
              </div>
            );
          })}
        </div>
      </Section>

      {allianceCategoryWins.length > 0 && (
        <Section label={t('win_rate_by_category', 'Win Rate by Category')} defaultOpen>
          {(() => {
            let maxWin = 1;
            for (const a of allianceCategoryWins) {
              if (a.GEN > maxWin) maxWin = a.GEN;
              if (a.SC > maxWin) maxWin = a.SC;
              if (a.ST > maxWin) maxWin = a.ST;
            }
            return (
              <>
                <div className="es-vbar-group">
                  {(['GEN', 'SC', 'ST'] as const).map(cat => (
                    <div key={cat} className="es-vbar-col">
                      <div className="es-vbar-track">
                        <div className="es-vbar-bar-group">
                          {allianceCategoryWins.map(a => (
                            <div
                              key={a.name}
                              className="es-vbar-bar-seg"
                              style={{ height: `${(a[cat] / maxWin) * 100}%`, background: a.color }}
                              title={`${a.name}: ${a[cat]}`}
                            >
                              {a[cat] > 0 && <span className="es-vbar-seg-count">{a[cat]}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="es-vbar-label">{cat}</span>
                    </div>
                  ))}
                </div>
                <div className="es-histogram-legend">
                  {allianceCategoryWins.map(a => (
                    <span key={a.name} className="es-histogram-legend-item">
                      <span className="es-dot" style={{ background: a.color }} />
                      {a.name} ({a.total})
                    </span>
                  ))}
                </div>
              </>
            );
          })()}
        </Section>
      )}

      {allianceMarginByCategory.length > 0 && (
        <Section label={t('margin_by_category', 'Avg Margin by Category')}>
          {(() => {
            let maxMargin = 1;
            for (const a of allianceMarginByCategory) {
              if (a.GEN > maxMargin) maxMargin = a.GEN;
              if (a.SC > maxMargin) maxMargin = a.SC;
              if (a.ST > maxMargin) maxMargin = a.ST;
            }
            return (
              <>
                <div className="es-vbar-group">
                  {(['GEN', 'SC', 'ST'] as const).map(cat => (
                    <div key={cat} className="es-vbar-col">
                      <div className="es-vbar-track">
                        <div className="es-vbar-bar-group">
                          {allianceMarginByCategory.map(a => (
                            <div
                              key={a.name}
                              className="es-vbar-bar-seg"
                              style={{ height: `${(a[cat] / maxMargin) * 100}%`, background: a.color }}
                              title={`${a.name}: ${formatMargin(a[cat])}`}
                            >
                              {a[cat] > 0 && <span className="es-vbar-seg-count">{formatMargin(a[cat])}</span>}
                            </div>
                          ))}
                        </div>
                      </div>
                      <span className="es-vbar-label">{cat}</span>
                    </div>
                  ))}
                </div>
                <div className="es-histogram-legend">
                  {allianceMarginByCategory.map(a => (
                    <span key={a.name} className="es-histogram-legend-item">
                      <span className="es-dot" style={{ background: a.color }} />
                      {a.name}
                    </span>
                  ))}
                </div>
              </>
            );
          })()}
        </Section>
      )}
    </>
  );
}
