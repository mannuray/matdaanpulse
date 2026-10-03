// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('../../services/ingest.service', () => ({ putShard: vi.fn(async () => ({})), deleteShard: vi.fn(async () => ({})) }));
vi.mock('../../services/geo.service', () => ({
  getStates: vi.fn(async () => [{ id: 1, name: 'Bihar' }]),
  getRegions: vi.fn(async () => []),
  getDistricts: vi.fn(async () => []),
}));
import * as svc from '../../services/ingest.service';
import { ApiError } from '../../services/api-client';
import { ShardsDialog, parseRanges } from './ShardsDialog';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('parseRanges', () => {
  it('parses "1-100, 120-130, 7"', () => expect(parseRanges('1-100, 120-130, 7')).toEqual([[1, 100], [120, 130], [7, 7]]));
  it('rejects junk and reversed ranges', () => { expect(parseRanges('a-b')).toBeNull(); expect(parseRanges('10-5')).toBeNull(); });
  it('rejects empty text and zero', () => { expect(parseRanges('')).toBeNull(); expect(parseRanges('0-5')).toBeNull(); });
});

describe('ShardsDialog', () => {
  it('saves a seat-range shard', async () => {
    const onSaved = vi.fn();
    render(<ShardsDialog open electionId="e" shards={[]} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'north' } });
    fireEvent.change(screen.getByLabelText('Seat numbers'), { target: { value: '1-100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shard' }));
    await waitFor(() => expect(svc.putShard).toHaveBeenCalledWith('e', 'north', { selector: { const_no_ranges: [[1, 100]] }, source_override: null }));
    expect(onSaved).toHaveBeenCalled();
  });
  it('refuses the reserved name', () => {
    render(<ShardsDialog open electionId="e" shards={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'rest' } });
    expect((screen.getByRole('button', { name: 'Save shard' }) as HTMLButtonElement).disabled).toBe(true);
  });
  it('shows the clashing seats on a 409', async () => {
    vi.mocked(svc.putShard).mockRejectedValueOnce(new ApiError('Shard overlaps south', 409, 'INGEST_OVERLAP', [], { other: 'south', sample: ['BR-1', 'BR-2'] }));
    render(<ShardsDialog open electionId="e" shards={[]} onClose={vi.fn()} onSaved={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Name'), { target: { value: 'north' } });
    fireEvent.change(screen.getByLabelText('Seat numbers'), { target: { value: '1-100' } });
    fireEvent.click(screen.getByRole('button', { name: 'Save shard' }));
    expect(await screen.findByText(/BR-1, BR-2/)).toBeTruthy();
  });
  it('deletes an existing shard', async () => {
    const onSaved = vi.fn();
    const shard = { name: 'south', seat_count: 10, source: null } as never;
    render(<ShardsDialog open electionId="e" shards={[shard]} onClose={vi.fn()} onSaved={onSaved} />);
    fireEvent.click(screen.getByRole('button', { name: 'Delete south' }));
    await waitFor(() => expect(svc.deleteShard).toHaveBeenCalledWith('e', 'south'));
    expect(onSaved).toHaveBeenCalled();
  });
});
