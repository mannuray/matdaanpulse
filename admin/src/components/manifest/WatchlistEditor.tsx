import { useEffect, useId, useRef, useState } from 'react';
import { Plus } from 'lucide-react';
import { ManifestSection } from './ManifestSection';
import { EmptyState, AddButton, ColorDot, RemoveButton, SearchableSelect, updateAt, removeAt } from './SharedControls';
import Spinner from '../atoms/Spinner';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import type { Watchlist, WatchlistEntry, Party, Constituency, Candidate } from '../../types';

/** A person found by name (for leaders with no seat in this election, e.g. Legislative Council members). */
export interface PersonHit { id: string; name: string }
type SearchPersons = (query: string) => Promise<PersonHit[]>;

/** At most this many person suggestions under the candidates. */
const MAX_PERSONS = 8;

/** Preset watchlists. The names are data: they become the watchlist's public name, so they are not re-cased. */
export const WATCHLIST_PRESETS = [
  { id: 'leaders', name: 'Leaders' },
  { id: 'cabinet', name: 'Cabinet' },
  { id: 'celebrities', name: 'Celebrities' },
  { id: 'rebels', name: 'Rebels' },
  { id: 'key_battles', name: 'Key Battles' },
  { id: 'first_timers', name: 'First-Timers' },
];

export function WatchlistRow({
  entry,
  eIdx,
  onUpdate,
  onRemove,
  parties,
  constituencies,
  partyMap,
  onSearchCandidates,
  onSearchPersons
}: {
  entry: WatchlistEntry;
  eIdx: number;
  onUpdate: (patch: Partial<WatchlistEntry>) => void;
  onRemove: () => void;
  parties: Party[];
  constituencies: Constituency[];
  partyMap: Map<string, Party>;
  onSearchCandidates: (query: string) => Promise<Candidate[]>;
  onSearchPersons?: SearchPersons;
}) {
  const listId = useId();
  const [searchTerm, setSearchTerm] = useState(entry.name);
  const [results, setResults] = useState<Candidate[]>([]);
  const [persons, setPersons] = useState<PersonHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [failed, setFailed] = useState(false);
  const latest = useRef(0);
  const n = eIdx + 1;

  // Keep state in sync with external data changes
  useEffect(() => {
    setSearchTerm(entry.name || '');
  }, [entry.name]);

  const handleSearch = async (query: string) => {
    setSearchTerm(query);
    // A typed name no longer refers to the picked person.
    onUpdate({ name: query, person_id: undefined });
    const request = ++latest.current;
    setFailed(false);
    if (query.length < 2) {
      setResults([]);
      setPersons([]);
      setShowDropdown(false);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const [res, people] = await Promise.all([onSearchCandidates(query), onSearchPersons ? onSearchPersons(query) : Promise.resolve([])]);
      if (request !== latest.current) return; // a newer query is on its way
      const cands = res || [];
      const known = new Set(cands.map(c => c.person_id));
      setResults(cands);
      setPersons((people || []).filter(p => !known.has(p.id)).slice(0, MAX_PERSONS));
      setShowDropdown(true);
    } catch {
      // The typed name is kept; tell the user the suggestions did not load.
      if (request === latest.current) { setResults([]); setPersons([]); setShowDropdown(false); setFailed(true); }
    } finally {
      if (request === latest.current) setLoading(false);
    }
  };

  const handleSelect = (c: Candidate) => {
    onUpdate({
      name: c.name,
      party_id: c.party_id || '',
      const_id: c.const_id,
      person_id: c.person_id
    });
    setSearchTerm(c.name);
    setShowDropdown(false);
  };

  const handleSelectPerson = (p: PersonHit) => {
    onUpdate({ name: p.name, person_id: p.id, const_id: '' });
    setSearchTerm(p.name);
    setShowDropdown(false);
  };

  const p = partyMap.get(entry.party_id);
  const open = showDropdown && (results.length > 0 || persons.length > 0);

  return (
    <tr>
      <td className="relative px-1.5 py-1 align-top">
        <div className="flex items-center gap-1.5">
          <Input
            role="combobox"
            aria-label={`Entry ${n} candidate`}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            className="h-8 text-xs"
            placeholder="Search candidate…"
            value={searchTerm || ''}
            onChange={e => { void handleSearch(e.target.value); }}
            onFocus={() => { if (results.length > 0) setShowDropdown(true); }}
            onBlur={() => setShowDropdown(false)}
            onKeyDown={(e) => { if (e.key === 'Escape' && open) { e.preventDefault(); setShowDropdown(false); } }}
          />
          {loading && <Spinner size={12} />}
        </div>
        {failed && <p role="status" className="mt-1 text-[11px] text-bad-text">Search failed — try again</p>}
        {open && (
          <ul id={listId} role="listbox" aria-label={`Entry ${n} candidates`} className="absolute left-1.5 right-1.5 top-full z-30 mt-1 min-w-[280px] list-none rounded-card border border-line bg-card p-1 shadow-lg">
            {results.map(r => (
              <li
                key={r.id}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); handleSelect(r); }}
                className="cursor-pointer rounded-control px-2.5 py-1.5 text-xs hover:bg-accent-soft"
              >
                <div className="font-semibold text-ink">{r.name}</div>
                <div className="text-[10px] text-muted">{r.party_id} · {r.const_id}</div>
              </li>
            ))}
            {persons.length > 0 && (
              <li role="presentation" className="px-2.5 pb-0.5 pt-1.5 text-[10px] font-semibold uppercase tracking-wide text-muted">People (no seat in this election)</li>
            )}
            {persons.map(p => (
              <li
                key={`p-${p.id}`}
                role="option"
                aria-selected={false}
                onMouseDown={(e) => { e.preventDefault(); handleSelectPerson(p); }}
                className="cursor-pointer rounded-control px-2.5 py-1.5 text-xs hover:bg-accent-soft"
              >
                <div className="font-semibold text-ink">{p.name}</div>
                <div className="text-[10px] text-muted">Person</div>
              </li>
            ))}
          </ul>
        )}
      </td>
      <td className="px-1.5 py-1 align-top">
        <Input aria-label={`Entry ${n} role`} className="h-8 text-xs" placeholder="Role (e.g. CM, rebel)" value={entry.role || ''}
          onChange={e => onUpdate({ role: e.target.value || undefined })} />
      </td>
      <td className="px-1.5 py-1 align-top">
        <div className="flex items-center gap-1.5">
          <SearchableSelect
            label={`Entry ${n} party`}
            value={entry.party_id}
            options={parties}
            onSelect={val => onUpdate({ party_id: val })}
            placeholder="Party…"
            getLabel={pp => pp.abbreviation || pp.name}
            getValue={pp => pp.id}
            filter={(pp, q) =>
              pp.name.toLowerCase().includes(q) ||
              (pp.abbreviation || '').toLowerCase().includes(q) ||
              pp.id.toLowerCase().includes(q)
            }
            renderItem={pp => (
              <span className="flex items-center gap-1.5">
                {pp.color && <ColorDot color={pp.color} />}
                <span className="font-medium">{pp.abbreviation || pp.id}</span>
                <span className="truncate text-muted">{pp.name}</span>
              </span>
            )}
          />
          {p?.color && <ColorDot color={p.color} />}
        </div>
      </td>
      <td className="px-1.5 py-1 align-top">
        <SearchableSelect
          label={`Entry ${n} constituency`}
          value={entry.const_id}
          options={constituencies}
          onSelect={val => onUpdate({ const_id: val })}
          placeholder="Constituency…"
          getLabel={c => `${c.name} (#${c.const_no})`}
          getValue={c => c.id}
          filter={(c, q) =>
            c.name.toLowerCase().includes(q) ||
            c.id.toLowerCase().includes(q) ||
            String(c.const_no).includes(q)
          }
          renderItem={c => <span><span className="font-semibold">#{c.const_no}</span> {c.name}</span>}
        />
      </td>
      <td className="px-1.5 py-1 align-top">
        <RemoveButton label={`Remove entry ${n}`} onClick={onRemove} />
      </td>
    </tr>
  );
}

export function WatchlistEditor({
  watchlists,
  contestingParties,
  constituencies,
  partyMap,
  onSearchCandidates,
  onSearchPersons,
  onUpdate
}: {
  watchlists: Watchlist[];
  contestingParties: Party[];
  constituencies: Constituency[];
  partyMap: Map<string, Party>;
  onSearchCandidates: (query: string) => Promise<Candidate[]>;
  onSearchPersons?: SearchPersons;
  onUpdate: (watchlists: Watchlist[]) => void;
}) {
  const items = watchlists || [];
  const unusedPresets = WATCHLIST_PRESETS.filter(p => !items.some(w => w && w.id === p.id));

  const updateWatchlist = (wIdx: number, patch: Partial<Watchlist>) => {
    onUpdate(updateAt(items, wIdx, patch));
  };

  const updateWatchlistEntry = (wIdx: number, eIdx: number, patch: Partial<WatchlistEntry>) => {
    const w = items[wIdx];
    if (w) updateWatchlist(wIdx, { entries: updateAt(w.entries || [], eIdx, patch) });
  };

  const removeWatchlistEntry = (wIdx: number, eIdx: number) => {
    const w = items[wIdx];
    if (w) updateWatchlist(wIdx, { entries: removeAt(w.entries || [], eIdx) });
  };

  const addWatchlist = (id: string, name: string) => {
    if (items.some(w => w && w.id === id)) return;
    onUpdate([...items, { id, name, entries: [] }]);
  };

  const removeWatchlist = (wIdx: number) => {
    onUpdate(removeAt(items, wIdx));
  };

  return (
    <ManifestSection title="Watchlists" description="Track key candidates on the live results dashboard" count={items.length}>
      {items.length === 0 && <EmptyState text="No watchlists configured." />}

      {items.map((w, wIdx) => {
        if (!w) return null;
        const entries = w.entries || [];
        return (
          <div key={w.id || wIdx} className="rounded-control border border-line bg-card">
            <div className="flex items-center justify-between gap-3 border-b border-line bg-subtle px-3 py-1.5">
              <Input
                aria-label={`Watchlist ${wIdx + 1} name`}
                className="h-8 border-transparent bg-transparent text-sm font-semibold"
                value={w.name || ''}
                placeholder="Watchlist name (e.g. VIP seats)"
                onChange={e => updateWatchlist(wIdx, { name: e.target.value })}
              />
              <div className="flex items-center gap-2">
                <span className="whitespace-nowrap text-xs text-muted">{entries.length} entries</span>
                <RemoveButton label={`Remove watchlist ${w.name || wIdx + 1}`} onClick={() => removeWatchlist(wIdx)} />
              </div>
            </div>

            <table aria-label={`${w.name || 'Watchlist'} entries`} className="w-full table-fixed border-collapse text-xs">
              <thead>
                <tr className="text-left text-[11px] text-ink-2">
                  <th scope="col" className="w-[35%] px-1.5 py-1.5 font-medium">Candidate</th>
                  <th scope="col" className="w-[20%] px-1.5 py-1.5 font-medium">Role</th>
                  <th scope="col" className="w-[20%] px-1.5 py-1.5 font-medium">Party</th>
                  <th scope="col" className="w-[20%] px-1.5 py-1.5 font-medium">Constituency</th>
                  <th scope="col" className="w-[5%] px-1.5 py-1.5"><span className="sr-only">Remove</span></th>
                </tr>
              </thead>
              <tbody>
                {entries.map((entry, eIdx) => (
                  <WatchlistRow
                    key={eIdx}
                    entry={entry}
                    eIdx={eIdx}
                    onUpdate={(patch) => updateWatchlistEntry(wIdx, eIdx, patch)}
                    onRemove={() => removeWatchlistEntry(wIdx, eIdx)}
                    parties={contestingParties || []}
                    constituencies={constituencies || []}
                    partyMap={partyMap}
                    onSearchCandidates={onSearchCandidates}
                    onSearchPersons={onSearchPersons}
                  />
                ))}
              </tbody>
            </table>
            {entries.length === 0 && <p className="px-3 py-5 text-center text-xs text-muted">No entries added to this watchlist.</p>}

            <div className="border-t border-line px-2 py-1.5">
              <AddButton label="Add entry" onClick={() =>
                updateWatchlist(wIdx, { entries: [...entries, { name: '', party_id: '', const_id: '' }] })} />
            </div>
          </div>
        );
      })}

      <div className="space-y-2">
        {unusedPresets.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {unusedPresets.map(p => (
              <Button key={p.id} size="sm" variant="outline" onClick={() => addWatchlist(p.id, p.name)}>
                <Plus size={12} aria-hidden />{p.name}
              </Button>
            ))}
          </div>
        )}
        <AddButton label="Custom watchlist" onClick={() => {
          const id = `custom_${Date.now()}`;
          addWatchlist(id, '');
        }} />
      </div>
    </ManifestSection>
  );
}
