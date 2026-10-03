// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ManifestSection } from './ManifestSection';
import { ChipSelect, DraftInput, ItemRow, SearchableSelect, moveItem } from './SharedControls';
import { AllianceEditor } from './AllianceEditor';
import { TrackedEditor } from './TrackedEditor';
import { WatchlistEditor } from './WatchlistEditor';
import { CompareHistoryEditor, GeoConfigEditor, LiveTabsEditor, MilestonesEditor, RevisionEditor, VoteSplitsEditor } from './MiscEditors';
import type { Alliance, Candidate, Constituency, Election, ManifestData, LiveTab, Party } from '../../types';

const party = (id: string, color: string | null = '#f97316'): Party => ({
  id, name: `${id} party`, color, symbol_url: null, eci_symbol_url: null, abbreviation: id,
  leader_name: null, founded_year: null, headquarters: null, website: null, wikipedia_url: null, description: null,
});
const PARTIES = [party('BJP'), party('JDU', '#22c55e'), party('INC', '#0ea5e9')];
const partyMap = new Map(PARTIES.map((p) => [p.id, p]));
const NDA: Alliance = { id: 'NDA', name: 'NDA', color: '#f97316', parties: ['BJP', 'JDU'] };
/** Any class from the deleted legacy stylesheet left in the markup. */
const LEGACY = '[class*="mf-"],[class*="form-input"],[class*="form-select"],.btn,.spinner,.admin-table,.striped';

afterEach(cleanup);

describe('ManifestSection', () => {
  it('is an always-open, labelled section: no toggle, the body always rendered', () => {
    render(<ManifestSection title="Milestones" description="Lines on the tally" count={2}><p>Body</p></ManifestSection>);
    const section = screen.getByRole('region', { name: 'Milestones' });
    expect(within(section).getByText('Body')).toBeTruthy();
    expect(within(section).getByText('2')).toBeTruthy();
    expect(within(section).getByText('Lines on the tally')).toBeTruthy();
    expect(within(section).queryByRole('button')).toBeNull();
    expect(section.querySelector('[aria-expanded]')).toBeNull();
    expect(section.querySelector(LEGACY)).toBeNull();
  });

  it('hides a zero count', () => {
    render(<ManifestSection title="Tracked" count={0}><p>Body</p></ManifestSection>);
    expect(within(screen.getByRole('region', { name: 'Tracked' })).queryByText('0')).toBeNull();
  });
});

describe('SharedControls', () => {
  it('ItemRow has labelled move and remove buttons', () => {
    const onUp = vi.fn();
    const onDown = vi.fn();
    const onRemove = vi.fn();
    render(<ItemRow index={1} showOrder onMoveUp={onUp} onMoveDown={onDown} onRemove={onRemove}><span>Row</span></ItemRow>);
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 down' }));
    fireEvent.click(screen.getByRole('button', { name: 'Remove item 2' }));
    expect([onUp.mock.calls.length, onDown.mock.calls.length, onRemove.mock.calls.length]).toEqual([1, 1, 1]);
    expect(screen.getByText('2')).toBeTruthy();
  });

  it('moveItem ignores a move past either end', () => {
    expect(moveItem(['a', 'b', 'c'], 0, -1)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 3)).toEqual(['a', 'b', 'c']);
    expect(moveItem(['a', 'b', 'c'], 2, 1)).toEqual(['a', 'c', 'b']);
  });

  it('SearchableSelect shows the selected label, filters, picks on mouse down and closes on Esc', () => {
    const onSelect = vi.fn();
    render(
      <SearchableSelect
        label="Party" value="JDU" options={PARTIES} onSelect={onSelect} placeholder="Party…"
        getLabel={(p) => p.abbreviation || p.name} getValue={(p) => p.id}
        filter={(p, q) => p.name.toLowerCase().includes(q)} renderItem={(p) => <span>{p.name}</span>}
      />,
    );
    const input = screen.getByRole('combobox', { name: 'Party' }) as HTMLInputElement;
    expect(input.value).toBe('JDU');
    fireEvent.focus(input);
    expect(input.getAttribute('aria-expanded')).toBe('true');
    expect(screen.getAllByRole('option')).toHaveLength(3);
    fireEvent.change(input, { target: { value: 'inc' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole('option', { name: 'INC party' }));
    expect(onSelect).toHaveBeenCalledWith('INC');
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.focus(input);
    expect(screen.getByRole('listbox')).toBeTruthy();
    fireEvent.keyDown(input, { key: 'Escape' });
    expect(screen.queryByRole('listbox')).toBeNull();
    // still focused: typing alone reopens the list
    fireEvent.change(input, { target: { value: 'bjp' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(input, { target: { value: 'jdu' } });
    expect(screen.getAllByRole('option')).toHaveLength(1);
  });

  it('ChipSelect lists unselected matches while typing, adds on pick, and removes with the chip button', () => {
    const onAdd = vi.fn();
    const onRemove = vi.fn();
    const options = [{ value: 'BJP', label: 'BJP party' }, { value: 'JDU', label: 'JDU party' }];
    render(<ChipSelect label="Add party" selected={['BJP']} options={options} onAdd={onAdd} onRemove={onRemove} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove BJP party' }));
    expect(onRemove).toHaveBeenCalledWith('BJP');
    const input = screen.getByRole('combobox', { name: 'Add party' });
    fireEvent.focus(input);
    expect(screen.queryByRole('listbox')).toBeNull();
    fireEvent.change(input, { target: { value: 'party' } });
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual(['JDU partyJDU']);
    fireEvent.mouseDown(screen.getByRole('option'));
    expect(onAdd).toHaveBeenCalledWith('JDU');
    expect((input as HTMLInputElement).value).toBe('');
  });

  it('DraftInput keeps text that does not parse yet, and follows changes made elsewhere', () => {
    function Harness() {
      const [nums, setNums] = useState<number[]>([1]);
      return (
        <>
          <DraftInput
            aria-label="Seats"
            value={nums.join(', ')}
            onCommit={(t) => {
              const next = t.split(',').map((s) => parseInt(s.trim(), 10)).filter((n) => !Number.isNaN(n));
              setNums(next);
              return next.join(', ');
            }}
          />
          <button type="button" onClick={() => setNums([9])}>reset</button>
          <output>{nums.join('|')}</output>
        </>
      );
    }
    render(<Harness />);
    const input = screen.getByLabelText('Seats') as HTMLInputElement;
    fireEvent.change(input, { target: { value: '1,' } });
    expect(input.value).toBe('1,');
    fireEvent.change(input, { target: { value: '1, 2' } });
    expect(screen.getByRole('status').textContent).toBe('1|2');
    fireEvent.click(screen.getByText('reset'));
    expect(input.value).toBe('9');
  });
});

describe('AllianceEditor', () => {
  it('edits fields, adds a party from the search, removes a party chip and the alliance', () => {
    const onUpdate = vi.fn();
    const { container } = render(<AllianceEditor alliances={[NDA]} contestingParties={PARTIES} partyMap={partyMap} onUpdate={onUpdate} />);
    expect(screen.getByRole('region', { name: 'Alliances' })).toBeTruthy();
    fireEvent.change(screen.getByLabelText('Alliance 1 name'), { target: { value: 'NDA+' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, name: 'NDA+' }]);
    fireEvent.change(screen.getByLabelText('Alliance 1 colour'), { target: { value: '#111111' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, color: '#111111' }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove JDU from NDA' }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, parties: ['BJP'] }]);
    fireEvent.focus(screen.getByRole('combobox', { name: 'Add party to NDA' }));
    fireEvent.mouseDown(screen.getByRole('option', { name: /INC party/ }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...NDA, parties: ['BJP', 'JDU', 'INC'] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove alliance NDA' }));
    expect(onUpdate).toHaveBeenLastCalledWith([]);
    expect(container.querySelector(LEGACY)).toBeNull();
  });

  it('Add alliance appends an empty one; with none, a plain note shows', () => {
    const onUpdate = vi.fn();
    render(<AllianceEditor alliances={[]} contestingParties={PARTIES} partyMap={partyMap} onUpdate={onUpdate} />);
    expect(screen.getByText('No alliances configured')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Add alliance' }));
    expect(onUpdate).toHaveBeenCalledWith([{ id: '', name: '', color: '#666666', parties: [] }]);
  });
});

describe('TrackedEditor', () => {
  it('shows alliance or party labels, removes with the chip button and adds from the search', () => {
    const onUpdate = vi.fn();
    const { container } = render(
      <TrackedEditor
        tracked={['NDA', 'INC']}
        trackedOptions={[{ id: 'NDA', name: 'NDA' }, { id: 'INC', name: 'INC party' }, { id: 'JDU', name: 'JDU party' }]}
        alliances={[NDA]} partyMap={partyMap} onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'Remove INC' }));
    expect(onUpdate).toHaveBeenLastCalledWith(['NDA']);
    const input = screen.getByRole('combobox', { name: 'Add to the tally' });
    fireEvent.focus(input);
    fireEvent.change(input, { target: { value: 'jd' } });
    fireEvent.mouseDown(screen.getByRole('option', { name: /JDU party/ }));
    expect(onUpdate).toHaveBeenLastCalledWith(['NDA', 'INC', 'JDU']);
    expect(container.querySelector(LEGACY)).toBeNull();
  });
});

const seat = (id: string, no: number, name: string): Constituency => ({
  id, election_id: 'e1', name, const_no: no, type: 'GEN', state_id: 1, district_id: null, region_id: null, voter_turnout: null, metadata: {},
});
const SEATS = [seat('k1', 1, 'Valmiki Nagar'), seat('k2', 2, 'Ramnagar'), seat('k142', 142, 'Patna Sahib')];
const cand = (id: string, name: string, party: string, constId: string): Candidate => ({
  id, name, party_id: party, const_id: constId, person_id: `p-${id}`, election_id: 'e1', party: null, is_incumbent: false,
  age: null, assets: null, liabilities: null, criminal_cases: null,
});
const election = (id: string, name: string, year: number): Election => ({
  id, name, type: 'VS', state_id: 1, year, status: 'Finalized', tentative_next_date: null, delimitation: null, manifest_url: null,
});
const ELECTIONS = [election('e1', 'Bihar 2020', 2020), election('e2', 'Bihar 2015', 2015)];
const electionMap = new Map(ELECTIONS.map((e) => [e.id, e]));

describe('WatchlistEditor', () => {
  it('preset buttons add a named watchlist; a custom one starts unnamed', () => {
    const onUpdate = vi.fn();
    render(<WatchlistEditor watchlists={[]} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn()} onUpdate={onUpdate} />);
    expect(screen.getByText('No watchlists configured.')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Leaders' }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ id: 'leaders', name: 'Leaders', entries: [] }]);
    fireEvent.click(screen.getByRole('button', { name: 'Custom watchlist' }));
    expect(onUpdate.mock.lastCall![0][0]).toMatchObject({ name: '', entries: [] });
  });

  it('an entry searches from two letters, ignores a stale answer, and fills party and seat on pick', async () => {
    let releaseOld!: (c: Candidate[]) => void;
    const search = vi.fn((q: string) => (q === 'ra'
      ? new Promise<Candidate[]>((r) => { releaseOld = r; })
      : Promise.resolve([cand('c1', 'Ravi Prasad', 'BJP', 'k142')])));
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: '', party_id: '', const_id: '' }] }];
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={search} onUpdate={onUpdate} />);
    const input = screen.getByRole('combobox', { name: 'Entry 1 candidate' });
    fireEvent.change(input, { target: { value: 'r' } });
    expect(search).not.toHaveBeenCalled();
    fireEvent.change(input, { target: { value: 'ra' } });
    fireEvent.change(input, { target: { value: 'rav' } });
    expect(await screen.findByRole('option', { name: /Ravi Prasad/ })).toBeTruthy();
    await act(async () => { releaseOld([cand('c2', 'Old Result', 'INC', 'k1')]); });
    expect(screen.queryByRole('option', { name: /Old Result/ })).toBeNull();
    fireEvent.mouseDown(screen.getByRole('option', { name: /Ravi Prasad/ }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...WL[0], entries: [{ name: 'Ravi Prasad', party_id: 'BJP', const_id: 'k142', person_id: 'p-c1' }] }]);
  });

  it('a failed candidate search shows a note and keeps the typed name', async () => {
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: '', party_id: '', const_id: '' }] }];
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={() => Promise.reject(new Error('x'))} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByRole('combobox', { name: 'Entry 1 candidate' }), { target: { value: 'rav' } });
    expect(await screen.findByText('Search failed — try again')).toBeTruthy();
    expect(onUpdate).toHaveBeenLastCalledWith([{ ...WL[0], entries: [{ name: 'rav', party_id: '', const_id: '' }] }]);
    expect(screen.getByRole('table', { name: 'Leaders entries' })).toBeTruthy();
  });

  it('stores the picked candidate\'s person_id, and clears it when the name is retyped', async () => {
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: '', party_id: '', const_id: '' }] }];
    const cand = { id: 'c1', name: 'Tejashwi Prasad Yadav', party_id: 'RJD', const_id: 'BR_VS_179_RAGHOPUR', person_id: 'p-ty' } as unknown as Candidate;
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn().mockResolvedValue([cand])} onUpdate={onUpdate} />);
    const box = screen.getAllByRole('combobox')[0];
    await act(async () => { fireEvent.change(box, { target: { value: 'Tej' } }); });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Tejashwi Prasad Yadav/ }));
    expect(onUpdate.mock.lastCall![0][0].entries[0]).toMatchObject({ name: 'Tejashwi Prasad Yadav', party_id: 'RJD', const_id: 'BR_VS_179_RAGHOPUR', person_id: 'p-ty' });
    await act(async () => { fireEvent.change(box, { target: { value: 'Someone else' } }); });
    expect(onUpdate.mock.lastCall![0][0].entries[0].person_id).toBeUndefined();
  });
  it('offers persons for leaders without a seat and stores person_id with an empty seat', async () => {
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: '', party_id: '', const_id: '' }] }];
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn().mockResolvedValue([])}
      onSearchPersons={vi.fn().mockResolvedValue([{ id: 'p-nk', name: 'Nitish Kumar' }])} onUpdate={onUpdate} />);
    await act(async () => { fireEvent.change(screen.getAllByRole('combobox')[0], { target: { value: 'Nitish' } }); });
    fireEvent.mouseDown(await screen.findByRole('option', { name: /Nitish Kumar/ }));
    expect(onUpdate.mock.lastCall![0][0].entries[0]).toMatchObject({ name: 'Nitish Kumar', person_id: 'p-nk', const_id: '' });
  });
  it('the role field and remove button act on their own entry', () => {
    const onUpdate = vi.fn();
    const WL = [{ id: 'leaders', name: 'Leaders', entries: [{ name: 'A', party_id: 'BJP', const_id: 'k1' }, { name: 'B', party_id: 'INC', const_id: 'k2' }] }];
    render(<WatchlistEditor watchlists={WL} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn()} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Entry 2 role'), { target: { value: 'CM' } });
    expect(onUpdate.mock.lastCall![0][0].entries[1]).toEqual({ name: 'B', party_id: 'INC', const_id: 'k2', role: 'CM' });
    fireEvent.click(screen.getByRole('button', { name: 'Remove entry 1' }));
    expect(onUpdate.mock.lastCall![0][0].entries).toEqual([WL[0].entries[1]]);
    expect((screen.getByRole('combobox', { name: 'Entry 2 constituency' }) as HTMLInputElement).value).toBe('Ramnagar (#2)');
  });
});

describe('MiscEditors', () => {
  it('milestones edit the label and seats; Add milestone appends', () => {
    const onUpdate = vi.fn();
    render(<MilestonesEditor milestones={[{ label: 'Majority', value: 122 }]} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Milestone 1 seats'), { target: { value: '123' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ label: 'Majority', value: 123 }]);
    fireEvent.click(screen.getByRole('button', { name: 'Add milestone' }));
    expect(onUpdate).toHaveBeenLastCalledWith([{ label: 'Majority', value: 122 }, { label: '', value: 0 }]);
  });

  it('history reorders with labelled buttons and keeps the years in step', () => {
    const onHistory = vi.fn();
    const onYears = vi.fn();
    render(
      <CompareHistoryEditor
        compareWith={[]} history={['e1', 'e2']} historyYears={[2020, 2015]} elections={ELECTIONS} electionMap={electionMap}
        onUpdateCompare={vi.fn()} onUpdateHistory={onHistory} onUpdateHistoryYears={onYears}
      />,
    );
    expect(screen.getByRole('region', { name: 'Compare and history' })).toBeTruthy();
    expect(screen.getByText('No comparison election set')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Move item 2 up' }));
    expect(onHistory).toHaveBeenLastCalledWith(['e2', 'e1']);
    expect(onYears).toHaveBeenLastCalledWith([2015, 2020]);
    fireEvent.change(screen.getByLabelText('History 1 year'), { target: { value: '2021' } });
    expect(onYears).toHaveBeenLastCalledWith([2021, 2015]);
  });

  it('vote splits pick the spoiler and the alliance it hurts', () => {
    const onUpdate = vi.fn();
    render(<VoteSplitsEditor voteSplits={[{ spoiler: '', hurts: '', label: '' }]} contestingParties={PARTIES} alliances={[NDA]} partyMap={partyMap} onUpdate={onUpdate} />);
    fireEvent.change(screen.getByLabelText('Vote split 1 spoiler'), { target: { value: 'INC' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ spoiler: 'INC', hurts: '', label: '' }]);
    fireEvent.change(screen.getByLabelText('Vote split 1 alliance'), { target: { value: 'NDA' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ spoiler: '', hurts: 'NDA', label: '' }]);
  });

  it('the map centre keeps a half-typed value, saves a complete one, and clearing it removes it', () => {
    function Geo() {
      const [geo, setGeo] = useState<ManifestData['geo']>({ map_url: '/geo/x.geojson' });
      return <><GeoConfigEditor geo={geo} onUpdate={setGeo} /><output>{JSON.stringify(geo)}</output></>;
    }
    render(<Geo />);
    const centre = screen.getByLabelText('Centre (lat, lng)') as HTMLInputElement;
    fireEvent.change(centre, { target: { value: '22.5,' } });
    expect(centre.value).toBe('22.5,');
    fireEvent.change(centre, { target: { value: '22.5, 82.5' } });
    expect(screen.getByRole('status').textContent).toBe('{"map_url":"/geo/x.geojson","center":[22.5,82.5]}');
    fireEvent.change(centre, { target: { value: '' } });
    expect(screen.getByRole('status').textContent).toBe('{"map_url":"/geo/x.geojson"}');
  });

  it('a live-tab seat list can be typed with commas', () => {
    function Tabs() {
      const [tabs, setTabs] = useState<LiveTab[]>([{ label: 'Patna', const_nos: [] }]);
      return <><LiveTabsEditor liveTabs={tabs} onUpdate={setTabs} /><output>{JSON.stringify(tabs)}</output></>;
    }
    render(<Tabs />);
    const seats = screen.getByLabelText('Tab 1 seats') as HTMLInputElement;
    fireEvent.change(seats, { target: { value: '1,' } });
    expect(seats.value).toBe('1,');
    fireEvent.change(seats, { target: { value: '1, 2' } });
    expect(screen.getByRole('status').textContent).toBe('[{"label":"Patna","const_nos":[1,2]}]');
    expect(screen.getByText('2 seats')).toBeTruthy();
  });

  it('a live-tab seat list with no valid number is not saved and shows a hint', () => {
    const onUpdate = vi.fn();
    render(<LiveTabsEditor liveTabs={[{ label: 'Patna', const_nos: [1, 2] }]} onUpdate={onUpdate} />);
    const seats = screen.getByLabelText('Tab 1 seats') as HTMLInputElement;
    fireEvent.change(seats, { target: { value: 'abc' } });
    expect(onUpdate).not.toHaveBeenCalled();
    expect(seats.value).toBe('abc');
    expect(screen.getByText('Enter seat numbers separated by commas')).toBeTruthy();
    fireEvent.change(seats, { target: { value: '' } });
    expect(onUpdate).toHaveBeenLastCalledWith([{ label: 'Patna', const_nos: [] }]);
    expect(screen.queryByText('Enter seat numbers separated by commas')).toBeNull();
  });

  it('the electoral roll revision totals and per-seat changes', () => {
    render(<RevisionEditor revision={{ label: 'SIR 2025', data: { 1: [1000, 900], 2: { pre: 500, post: 550 } } }} constituencies={SEATS} />);
    const section = screen.getByRole('region', { name: 'Electoral roll revision' });
    expect(within(section).getByText('SIR 2025')).toBeTruthy();
    expect(within(section).getByText('1,500')).toBeTruthy();
    expect(within(section).getByText('1,450')).toBeTruthy();
    const table = within(section).getByRole('table', { name: 'Revision by seat' });
    expect(within(table).getByText('Valmiki Nagar')).toBeTruthy();
    expect(within(table).getByText('-100 (-10.0%)')).toBeTruthy();
    expect(within(table).getByText('+50 (+10.0%)')).toBeTruthy();
  });

  it('no editor renders a legacy class', () => {
    const { container } = render(
      <>
        <WatchlistEditor watchlists={[{ id: 'leaders', name: 'Leaders', entries: [{ name: 'A', party_id: 'BJP', const_id: 'k1' }] }]} contestingParties={PARTIES} constituencies={SEATS} partyMap={partyMap} onSearchCandidates={vi.fn()} onUpdate={vi.fn()} />
        <MilestonesEditor milestones={[{ label: 'Majority', value: 122 }]} onUpdate={vi.fn()} />
        <CompareHistoryEditor compareWith={['e1']} history={['e2']} historyYears={[2015]} elections={ELECTIONS} electionMap={electionMap} onUpdateCompare={vi.fn()} onUpdateHistory={vi.fn()} onUpdateHistoryYears={vi.fn()} />
        <VoteSplitsEditor voteSplits={[{ spoiler: 'INC', hurts: 'NDA', label: 'Splitter' }]} contestingParties={PARTIES} alliances={[NDA]} partyMap={partyMap} onUpdate={vi.fn()} />
        <GeoConfigEditor geo={{ map_url: '/geo/x.geojson', center: [22.5, 82.5], zoom: 6 }} onUpdate={vi.fn()} />
        <LiveTabsEditor liveTabs={[{ label: 'Patna', const_nos: [1, 2] }]} onUpdate={vi.fn()} />
        <RevisionEditor revision={{ data: { 1: [1000, 900] } }} constituencies={SEATS} />
      </>,
    );
    expect(container.querySelector(LEGACY)).toBeNull();
    expect(container.innerHTML).not.toMatch(/var\(--(bg-|text-|border|space-|danger|success|radius)/);
  });
});
