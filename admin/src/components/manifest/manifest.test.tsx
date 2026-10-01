// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { useState } from 'react';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { ManifestSection } from './ManifestSection';
import { ChipSelect, DraftInput, ItemRow, SearchableSelect, moveItem } from './SharedControls';
import { AllianceEditor } from './AllianceEditor';
import { TrackedEditor } from './TrackedEditor';
import type { Alliance, Party } from '../../types';

const party = (id: string, color: string | null = '#f97316'): Party => ({
  id, name: `${id} party`, color, symbol_url: null, eci_symbol_url: null, abbreviation: id,
  leader_name: null, founded_year: null, headquarters: null, website: null, wikipedia_url: null, description: null,
});
const PARTIES = [party('BJP'), party('JDU', '#22c55e'), party('INC', '#0ea5e9')];
const partyMap = new Map(PARTIES.map((p) => [p.id, p]));
const NDA: Alliance = { id: 'NDA', name: 'NDA', color: '#f97316', parties: ['BJP', 'JDU'] };
/** Any legacy admin.css class left in the markup. */
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
