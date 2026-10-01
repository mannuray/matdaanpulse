import { useState } from 'react';
import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, ColorDot, DraftInput, ItemRow, updateAt, removeAt, moveItem } from './SharedControls';
import { Input, Select } from '../ui/Input';
import { Field } from '../ui/Field';
import { cn } from '../ui/cn';
import type { Election, Alliance, Party, Milestone, VoteSplit, LiveTab, Constituency, ManifestData } from '../../types';

const fmt = (n: number) => n.toLocaleString('en-IN');

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
    <ManifestSection title="Milestones" description="Horizontal marker lines on the seat tally (e.g. majority)" count={items.length}>
      {items.map((m, i) => (
        <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
          <Input aria-label={`Milestone ${i + 1} label`} className="h-8 flex-1 text-xs" placeholder="Label (e.g. Majority)" value={m.label || ''}
            onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          <Input aria-label={`Milestone ${i + 1} seats`} type="number" className="h-8 w-24 text-xs" placeholder="Seats" value={m.value ?? ''}
            onChange={e => onUpdate(updateAt(items, i, { value: Number(e.target.value) }))} />
        </ItemRow>
      ))}
      <AddButton label="Add milestone" onClick={() =>
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
  const options = (elections || []).map(el => el && <option key={el.id} value={el.id}>{el.name} ({el.year})</option>);

  return (
    <ManifestSection title="Compare and history" description="Link to previous elections for swing analysis" count={cw.length + h.length}>
      <div className="space-y-2">
        <h4 className="text-xs font-medium text-ink-2">Swing comparison</h4>
        {cw.length === 0 && <EmptyState text="No comparison election set" />}
        {cw.map((id, i) => {
          const el = electionMap.get(id);
          return (
            <ItemRow key={i} index={i} showOrder onRemove={() => onUpdateCompare(removeAt(cw, i))}
              onMoveUp={() => onUpdateCompare(moveItem(cw, i, i - 1))}
              onMoveDown={() => onUpdateCompare(moveItem(cw, i, i + 1))}>
              <Select aria-label={`Comparison ${i + 1} election`} className="h-8 flex-1 text-xs" value={id || ''}
                onChange={e => { const a = [...cw]; a[i] = e.target.value; onUpdateCompare(a); }}>
                <option value="">Select election…</option>
                {options}
              </Select>
              {el && <span className="text-[11px] text-muted">{el.type} {el.year}</span>}
            </ItemRow>
          );
        })}
        <AddButton label="Add comparison" onClick={() => onUpdateCompare([...cw, ''])} />
      </div>

      <div className="space-y-2 border-t border-line pt-3">
        <h4 className="text-xs font-medium text-ink-2">Historical elections</h4>
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
              <Select aria-label={`History ${i + 1} election`} className="h-8 flex-1 text-xs" value={id || ''}
                onChange={e => { const a = [...h]; a[i] = e.target.value; onUpdateHistory(a); }}>
                <option value="">Select election…</option>
                {options}
              </Select>
              <Input aria-label={`History ${i + 1} year`} type="number" placeholder="Year" className="h-8 w-20 text-xs"
                value={hy[i] ?? ''} onChange={e => { const a = [...hy]; a[i] = Number(e.target.value); onUpdateHistoryYears(a); }} />
              {el && <span className="text-[11px] text-muted">{el.type}</span>}
            </ItemRow>
          );
        })}
        <AddButton label="Add history election" onClick={() => {
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
    <ManifestSection title="Vote splits" description="Parties that split votes from an alliance" count={items.length}>
      {items.length === 0 && <EmptyState text="No vote split rules configured" />}
      {items.map((vs, i) => {
        if (!vs) return null;
        const sp = partyMap.get(vs.spoiler);
        const ha = (alliances || []).find(a => a && a.id === vs.hurts);
        return (
          <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
            <div className="flex items-center gap-1.5">
              <Select aria-label={`Vote split ${i + 1} spoiler`} className="h-8 w-40 text-xs" value={vs.spoiler || ''}
                onChange={e => onUpdate(updateAt(items, i, { spoiler: e.target.value }))}>
                <option value="">Spoiler party…</option>
                {(contestingParties ?? []).map(p => p && <option key={p.id} value={p.id}>{p.abbreviation || p.name}</option>)}
              </Select>
              {sp?.color && <ColorDot color={sp.color} />}
            </div>
            <span className="text-[11px] text-muted">hurts</span>
            <div className="flex items-center gap-1.5">
              <Select aria-label={`Vote split ${i + 1} alliance`} className="h-8 w-40 text-xs" value={vs.hurts || ''}
                onChange={e => onUpdate(updateAt(items, i, { hurts: e.target.value }))}>
                <option value="">Alliance…</option>
                {(alliances ?? []).map(a => a && <option key={a.id} value={a.id}>{a.name}</option>)}
              </Select>
              {ha && <ColorDot color={ha.color} />}
            </div>
            <Input aria-label={`Vote split ${i + 1} reason`} className="h-8 w-36 text-xs" placeholder="Reason (e.g. Splitter)" value={vs.label || ''}
              onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          </ItemRow>
        );
      })}
      <AddButton label="Add vote split" onClick={() =>
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
    <ManifestSection title="Geo config" description="Map GeoJSON source and projection settings">
      <div className="grid grid-cols-[1fr_1fr_auto] items-start gap-3">
        <Field label="Map URL">
          <Input placeholder="/geo/india_pc.geojson" value={g.map_url || ''}
            onChange={e => onUpdate({ ...g, map_url: e.target.value || undefined })} />
        </Field>
        <Field label="Centre (lat, lng)" hint="Two numbers, e.g. 22.5, 82.5">
          <DraftInput
            placeholder="22.5, 82.5"
            value={Array.isArray(g.center) ? g.center.join(', ') : ''}
            onCommit={text => {
              const parts = text.split(',').map(s => parseFloat(s.trim()));
              if (parts.length === 2 && parts.every(n => !Number.isNaN(n))) {
                onUpdate({ ...g, center: parts as [number, number] });
                return parts.join(', ');
              }
              if (!text.trim()) {
                const { center: _, ...rest } = g;
                onUpdate(rest);
                return '';
              }
              return null; // not a complete pair yet: keep typing
            }}
          />
        </Field>
        <Field label="Zoom">
          <Input type="number" placeholder="4" className="w-20" value={g.zoom ?? ''}
            onChange={e => onUpdate({ ...g, zoom: e.target.value ? Number(e.target.value) : undefined })} />
        </Field>
      </div>
    </ManifestSection>
  );
}

// ── Live Tabs Editor ──

/** Seat-number list for one tab. Text that holds no valid number is not saved (it would wipe the list). */
function TabSeats({ n, value, onChange }: { n: number; value: string; onChange: (nums: number[]) => void }) {
  const [invalid, setInvalid] = useState(false);
  return (
    <div className="min-w-[160px] flex-1">
      <DraftInput
        aria-label={`Tab ${n} seats`}
        className="h-8 text-xs"
        placeholder="Constituency numbers (1, 2, 3…)"
        value={value}
        onCommit={text => {
          const nums = text.split(',').map(s => parseInt(s.trim(), 10)).filter(x => !Number.isNaN(x));
          if (nums.length === 0 && text.trim()) { setInvalid(true); return null; }
          setInvalid(false);
          onChange(nums);
          return nums.join(', ');
        }}
      />
      {invalid && <p className="mt-1 text-[11px] text-bad-text">Enter seat numbers separated by commas</p>}
    </div>
  );
}

export function LiveTabsEditor({
  liveTabs,
  onUpdate
}: {
  liveTabs: LiveTab[];
  onUpdate: (tabs: LiveTab[]) => void;
}) {
  const items = liveTabs || [];
  return (
    <ManifestSection title="Live tabs" description="Custom filtered tabs on the results page" count={items.length}>
      {items.length === 0 && <EmptyState text="No custom tabs configured" />}
      {items.map((tab, i) => (
        <ItemRow key={i} index={i} onRemove={() => onUpdate(removeAt(items, i))}>
          <Input aria-label={`Tab ${i + 1} label`} className="h-8 w-40 text-xs" placeholder="Tab label" value={tab.label || ''}
            onChange={e => onUpdate(updateAt(items, i, { label: e.target.value }))} />
          <TabSeats n={i + 1} value={(tab.const_nos || []).join(', ')} onChange={nums => onUpdate(updateAt(items, i, { const_nos: nums }))} />
          <span className="whitespace-nowrap text-[11px] text-muted">{(tab.const_nos || []).length} seats</span>
        </ItemRow>
      ))}
      <AddButton label="Add tab" onClick={() =>
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
  const signed = (n: number) => `${n >= 0 ? '+' : ''}${fmt(n)}`;
  const signedPct = (p: number) => `${p >= 0 ? '+' : ''}${p.toFixed(1)}%`;

  return (
    <ManifestSection
      title="Electoral roll revision"
      description="Voter list cleanup — dead or duplicate voters removed"
      count={entries.length}
      badge={label ? <span className="text-xs text-muted">{label}</span> : undefined}
    >
      {entries.length > 0 ? (
        <>
          <div className="flex flex-wrap gap-4 text-xs text-ink-2">
            <span>Pre: <strong className="font-semibold text-ink">{fmt(totalPre)}</strong></span>
            <span>Post: <strong className="font-semibold text-ink">{fmt(totalPost)}</strong></span>
            <span className={totalNet >= 0 ? 'text-ok-text' : 'text-bad-text'}>
              Net: <strong className="font-semibold">{signed(totalNet)}</strong>
              {totalPre > 0 && <span> ({((totalNet / totalPre) * 100).toFixed(1)}%)</span>}
            </span>
          </div>
          <table aria-label="Revision by seat" className="w-full border-collapse text-xs">
            <thead>
              <tr className="text-left text-[11px] text-ink-2">
                <th scope="col" className="w-12 py-1.5 pr-2 font-medium">#</th>
                <th scope="col" className="py-1.5 pr-2 font-medium">Constituency</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Pre</th>
                <th scope="col" className="py-1.5 pr-2 text-right font-medium">Post</th>
                <th scope="col" className="py-1.5 text-right font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line border-t border-line">
              {entries.map(([id, pre, post]) => {
                const constNo = id;
                const c = (constituencies || []).find(cc => cc && String(cc.const_no) === constNo);
                const net = (post || 0) - (pre || 0);
                const pct = pre > 0 ? ((net / pre) * 100) : 0;
                return (
                  <tr key={id}>
                    <td className="py-1.5 pr-2 font-mono text-muted">{constNo}</td>
                    <td className="py-1.5 pr-2 text-ink">{c?.name?.replace(/_/g, ' ') || `Seat #${constNo}`}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(pre || 0)}</td>
                    <td className="py-1.5 pr-2 text-right tabular-nums">{fmt(post || 0)}</td>
                    <td className={cn('py-1.5 text-right font-medium tabular-nums', net > 0 ? 'text-ok-text' : net < 0 ? 'text-bad-text' : 'text-ink-2')}>
                      {signed(net)} ({signedPct(pct)})
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </>
      ) : (
        <EmptyState text="No revision data. Add it in the JSON tab." />
      )}
    </ManifestSection>
  );
}
