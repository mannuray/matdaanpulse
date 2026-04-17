import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, ItemRow, updateAt, removeAt, moveItem } from './SharedControls';
import type { Election, Alliance, Party, Milestone, VoteSplit, LiveTab, Constituency, ManifestData } from '../../types';

// ── Milestones Editor ──

export function MilestonesEditor({
  milestones,
  onUpdate
}: {
  milestones: Milestone[];
  onUpdate: (milestones: Milestone[]) => void;
}) {
  const items = milestones || [];
  return (
    <ManifestSection title="Milestones" description="Horizontal marker lines on the seat tally (e.g. Majority)" count={items.length}>
      {items.map((m, i) => (
        <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
          <input className="form-input" placeholder="Label (e.g. Majority)" value={m.label || ''} style={{ flex: 1 }}
            onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          <input className="form-input" type="number" placeholder="Seats" value={m.value ?? ''}
            onChange={e => onUpdate(updateAt(items, i, { value: Number(e.target.value) }))} style={{ width: 100 }} />
        </ItemRow>
      ))}
      <AddButton label="Add Milestone" onClick={() =>
        onUpdate([...items, { label: '', value: 0 }])} />
    </ManifestSection>
  );
}

// ── Compare & History Editor ──

export function CompareHistoryEditor({
  compareWith,
  history,
  historyYears,
  elections,
  electionMap,
  onUpdateCompare,
  onUpdateHistory,
  onUpdateHistoryYears
}: {
  compareWith: string[];
  history: string[];
  historyYears: number[];
  elections: Election[];
  electionMap: Map<string, Election>;
  onUpdateCompare: (val: string[]) => void;
  onUpdateHistory: (val: string[]) => void;
  onUpdateHistoryYears: (val: number[]) => void;
}) {
  const cw = compareWith || [];
  const h = history || [];
  const hy = historyYears || [];

  return (
    <ManifestSection title="Compare & History" description="Link to previous elections for swing analysis" count={cw.length + h.length}>
      <div className="mf-sub-section">
        <div className="mf-sub-header">
          <span className="mf-sub-title">Swing Comparison</span>
        </div>
        {cw.length === 0 && <EmptyState text="No comparison election set" />}
        {cw.map((id, i) => {
          const el = electionMap.get(id);
          return (
            <ItemRow key={i} index={i} showOrder onRemove={() => onUpdateCompare(removeAt(cw, i))}
              onMoveUp={() => onUpdateCompare(moveItem(cw, i, i - 1))}
              onMoveDown={() => onUpdateCompare(moveItem(cw, i, i + 1))}>
              <select className="form-select" value={id || ''} style={{ flex: 1 }}
                onChange={e => { const a = [...cw]; a[i] = e.target.value; onUpdateCompare(a); }}>
                <option value="">Select election...</option>
                {(elections || []).map(el => el && <option key={el.id} value={el.id}>{el.name} ({el.year})</option>)}
              </select>
              {el && <span className="mf-inline-hint">{el.type} {el.year}</span>}
            </ItemRow>
          );
        })}
        <AddButton label="Add Comparison" onClick={() => onUpdateCompare([...cw, ''])} />
      </div>

      <div className="mf-sub-section">
        <div className="mf-sub-header">
          <span className="mf-sub-title">Historical Elections</span>
        </div>
        {h.length === 0 && <EmptyState text="No history elections linked" />}
        {h.map((id, i) => {
          const el = electionMap.get(id);
          return (
            <ItemRow key={i} index={i} showOrder onRemove={() => {
              onUpdateHistory(removeAt(h, i));
              onUpdateHistoryYears(removeAt(hy, i));
            }}
              onMoveUp={() => { onUpdateHistory(moveItem(h, i, i - 1)); onUpdateHistoryYears(moveItem(hy, i, i - 1)); }}
              onMoveDown={() => { onUpdateHistory(moveItem(h, i, i + 1)); onUpdateHistoryYears(moveItem(hy, i, i + 1)); }}>
              <select className="form-select" value={id || ''} style={{ flex: 1 }}
                onChange={e => { const a = [...h]; a[i] = e.target.value; onUpdateHistory(a); }}>
                <option value="">Select election...</option>
                {(elections || []).map(el => el && <option key={el.id} value={el.id}>{el.name} ({el.year})</option>)}
              </select>
              <input className="form-input" type="number" placeholder="Year" style={{ width: 80 }}
                value={hy[i] ?? ''} onChange={e => { const a = [...hy]; a[i] = Number(e.target.value); onUpdateHistoryYears(a); }} />
              {el && <span className="mf-inline-hint">{el.type}</span>}
            </ItemRow>
          );
        })}
        <AddButton label="Add History Election" onClick={() => {
          onUpdateHistory([...h, '']);
          onUpdateHistoryYears([...hy, 0]);
        }} />
      </div>
    </ManifestSection>
  );
}

// ── Vote Splits Editor ──

export function VoteSplitsEditor({
  voteSplits,
  contestingParties,
  alliances,
  partyMap,
  onUpdate
}: {
  voteSplits: VoteSplit[];
  contestingParties: Party[];
  alliances: Alliance[];
  partyMap: Map<string, Party>;
  onUpdate: (vs: VoteSplit[]) => void;
}) {
  const items = voteSplits || [];
  return (
    <ManifestSection title="Vote Splits" description="Parties that split votes from an alliance" count={items.length}>
      {items.length === 0 && <EmptyState text="No vote split rules configured" />}
      {items.map((vs, i) => {
        if (!vs) return null;
        const sp = partyMap.get(vs.spoiler);
        const ha = (alliances || []).find(a => a && a.id === vs.hurts);
        return (
          <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
            <div className="mf-vs-row" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div className="mf-vs-field" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <select className="form-select mf-input-sm" value={vs.spoiler || ''}
                  onChange={e => onUpdate(updateAt(items, i, { spoiler: e.target.value }))}>
                  <option value="">Spoiler Party...</option>
                  {(contestingParties ?? []).map(p => p && <option key={p.id} value={p.id}>{p.abbreviation || p.name}</option>)}
                </select>
                {sp?.color && <span className="mf-chip-dot" style={{ background: sp.color }} />}
              </div>
              <span className="mf-vs-arrow" style={{ fontSize: '11px', color: 'var(--text-muted)' }}>hurts</span>
              <div className="mf-vs-field" style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                <select className="form-select mf-input-sm" value={vs.hurts || ''}
                  onChange={e => onUpdate(updateAt(items, i, { hurts: e.target.value }))}>
                  <option value="">Alliance...</option>
                  {(alliances ?? []).map(a => a && <option key={a.id} value={a.id}>{a.name}</option>)}
                </select>
                {ha && <span className="mf-chip-dot" style={{ background: ha.color }} />}
              </div>
              <input className="form-input mf-input-sm" placeholder="Reason (e.g. Splitter)" value={vs.label || ''} style={{ width: 140 }}
                onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
            </div>
          </ItemRow>
        );
      })}
      <AddButton label="Add Vote Split" onClick={() =>
        onUpdate([...items, { spoiler: '', hurts: '', label: '' }])} />
    </ManifestSection>
  );
}

// ── Geo Config Editor ──

export function GeoConfigEditor({
  geo,
  onUpdate
}: {
  geo: ManifestData['geo'];
  onUpdate: (geo: ManifestData['geo']) => void;
}) {
  const g = geo || {};
  return (
    <ManifestSection title="Geo Config" description="Map GeoJSON source and projection settings">
      <div className="mf-geo-grid">
        <div className="mf-field-group">
          <label className="mf-field-label">Map URL</label>
          <input className="form-input" placeholder="/geo/india_pc.geojson" value={g.map_url || ''}
            onChange={e => onUpdate({ ...g, map_url: e.target.value || undefined })} />
        </div>
        <div className="mf-field-group">
          <label className="mf-field-label">Center (lat, lng)</label>
          <input className="form-input" placeholder="22.5, 82.5" value={Array.isArray(g.center) ? g.center.join(', ') : ''}
            onChange={e => {
              const parts = e.target.value.split(',').map(s => parseFloat(s.trim()));
              if (parts.length === 2 && parts.every(n => !isNaN(n))) {
                onUpdate({ ...g, center: parts as [number, number] });
              } else if (!e.target.value.trim()) {
                const { center: _, ...rest } = g;
                onUpdate(rest);
              }
            }} />
        </div>
        <div className="mf-field-group">
          <label className="mf-field-label">Zoom</label>
          <input className="form-input" type="number" placeholder="4" value={g.zoom ?? ''} style={{ width: 80 }}
            onChange={e => onUpdate({ ...g, zoom: e.target.value ? Number(e.target.value) : undefined })} />
        </div>
      </div>
    </ManifestSection>
  );
}

// ── Live Tabs Editor ──

export function LiveTabsEditor({
  liveTabs,
  onUpdate
}: {
  liveTabs: LiveTab[];
  onUpdate: (tabs: LiveTab[]) => void;
}) {
  const items = liveTabs || [];
  return (
    <ManifestSection title="Live Tabs" description="Custom filtered tabs on the results page" count={items.length}>
      {items.length === 0 && <EmptyState text="No custom tabs configured" />}
      {items.map((tab, i) => (
        <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
          <input className="form-input" placeholder="Tab Label" value={tab.label || ''} style={{ width: 160 }}
            onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          <input className="form-input" placeholder="Constituency numbers (1, 2, 3...)" value={(tab.const_nos || []).join(', ')}
            onChange={e => {
              const nums = e.target.value.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
              onUpdate(updateAt(items, i, { const_nos: nums }));
            }} style={{ flex: 1 }} />
          <span className="mf-inline-hint">{(tab.const_nos || []).length} seats</span>
        </ItemRow>
      ))}
      <AddButton label="Add Tab" onClick={() =>
        onUpdate([...items, { label: '', const_nos: [] }])} />
    </ManifestSection>
  );
}

// ── Revision Editor ──

export function RevisionEditor({
  revision,
  constituencies
}: {
  revision: ManifestData['revision'];
  constituencies: Constituency[];
}) {
  const rev = revision;
  if (!rev) return null;

  let label = '';
  let entries: [string, number, number][] = [];
  if (rev && typeof rev === 'object') {
    if ('data' in rev && typeof rev.data === 'object') {
      label = rev.label || (rev as any).revision_label || '';
      const data = rev.data as Record<string, number[] | { pre: number; post: number }>;
      for (const [k, v] of Object.entries(data || {})) {
        if (Array.isArray(v)) entries.push([k, v[0] || 0, v[1] || 0]);
        else if (v && typeof v === 'object') entries.push([k, v.pre || 0, v.post || 0]);
      }
    }
  }

  entries.sort((a, b) => Number(a[0]) - Number(b[0]));

  const totalPre = entries.reduce((s, e) => s + (e[1] || 0), 0);
  const totalPost = entries.reduce((s, e) => s + (e[2] || 0), 0);
  const totalNet = totalPost - totalPre;

  return (
    <ManifestSection
      title="Electoral Roll Revision"
      description="Voter list cleanup — dead/duplicate voters removed"
      count={entries.length}
      badge={label ? <span className="mf-inline-hint" style={{ marginLeft: 8 }}>{label}</span> : undefined}
    >
      {entries.length > 0 ? (
        <>
          <div className="mf-revision-summary">
            <span>Pre: <strong>{totalPre.toLocaleString()}</strong></span>
            <span>Post: <strong>{totalPost.toLocaleString()}</strong></span>
            <span style={{ color: totalNet >= 0 ? 'var(--success)' : 'var(--danger)' }}>
              Net: <strong>{totalNet >= 0 ? '+' : ''}{totalNet.toLocaleString()}</strong>
              {totalPre > 0 && <span> ({((totalNet / totalPre) * 100).toFixed(1)}%)</span>}
            </span>
          </div>
          <div className="mf-revision-table">
            <div className="mf-revision-header">
              <span>#</span>
              <span>Constituency</span>
              <span style={{ textAlign: 'right' }}>Pre</span>
              <span style={{ textAlign: 'right' }}>Post</span>
              <span style={{ textAlign: 'right' }}>Change</span>
            </div>
            {entries.map(([id, pre, post]) => {
              const constNo = id;
              const c = (constituencies || []).find(cc => cc && String(cc.const_no) === constNo);
              const net = (post || 0) - (pre || 0);
              const pct = pre > 0 ? ((net / pre) * 100) : 0;
              return (
                <div key={id} className="mf-revision-row">
                  <span className="mf-revision-no">{constNo}</span>
                  <span>{c?.name?.replace(/_/g, ' ') || `Seat #${constNo}`}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(pre || 0).toLocaleString()}</span>
                  <span style={{ textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{(post || 0).toLocaleString()}</span>
                  <span style={{
                    textAlign: 'right', fontVariantNumeric: 'tabular-nums', fontWeight: 500,
                    color: net > 0 ? 'var(--success)' : net < 0 ? 'var(--danger)' : 'var(--text-secondary)',
                  }}>
                    {net >= 0 ? '+' : ''}{net.toLocaleString()} ({pct >= 0 ? '+' : ''}{pct.toFixed(1)}%)
                  </span>
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <div className="mf-empty"><span>No revision data. Add via JSON tab.</span></div>
      )}
    </ManifestSection>
  );
}
