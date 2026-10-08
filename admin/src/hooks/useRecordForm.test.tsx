// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, renderHook, waitFor } from '@testing-library/react';

const toast = vi.hoisted(() => ({ toast: vi.fn(), toastError: vi.fn() }));
vi.mock('../context/ToastContext', () => ({ useToast: () => toast }));
import { useRecordForm, type RecordFormOptions } from './useRecordForm';
import { ApiError } from '../services/api-client';

interface Rec { id: string; name: string; note: string | null }
interface Form { name: string; note: string }
const EMPTY: Form = { name: '', note: '' };
const toForm = (r: Rec): Form => ({ name: r.name, note: r.note ?? '' });

afterEach(() => vi.clearAllMocks());

function setup(over: Partial<RecordFormOptions<Rec, Form>> = {}, id: string | null = 'r1') {
  const load = vi.fn(async (rid: string): Promise<Rec> => ({ id: rid, name: 'Patna', note: null }));
  const save = vi.fn(async () => {});
  const opts: RecordFormOptions<Rec, Form> = {
    id: id ?? undefined, load, toForm, empty: EMPTY, save,
    messages: { loadFailed: 'Load failed', saveFailed: 'Save failed', saved: 'Saved' },
    ...over,
  };
  const hook = renderHook((p: { id?: string }) => useRecordForm({ ...opts, ...(over.load ? {} : { load }), id: p.id }), { initialProps: { id: id ?? undefined } as { id?: string } });
  return { ...hook, load: (over.load as typeof load) ?? load, save: (over.save as typeof save) ?? save };
}

describe('useRecordForm load', () => {
  it('loads the record, fills the form and is clean', async () => {
    const { result, load } = setup();
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(load).toHaveBeenCalledWith('r1');
    expect(result.current.record?.name).toBe('Patna');
    expect(result.current.form).toEqual({ name: 'Patna', note: '' });
    expect(result.current.dirty).toBe(false);
    expect(result.current.loadError).toBeNull();
  });

  it('does nothing without an id', () => {
    const { result, load } = setup({}, null);
    expect(result.current.loading).toBe(false);
    expect(load).not.toHaveBeenCalled();
    expect(result.current.form).toEqual(EMPTY);
  });

  it('a 404 is not_found without a toast; other failures are "failed" and toast', async () => {
    const nf = setup({ load: vi.fn(async () => { throw new ApiError('nope', 404); }) });
    await waitFor(() => expect(nf.result.current.loadError).toBe('not_found'));
    expect(toast.toastError).not.toHaveBeenCalled();
    nf.unmount();
    const failed = setup({ load: vi.fn(async () => { throw new ApiError('boom', 500); }) });
    await waitFor(() => expect(failed.result.current.loadError).toBe('failed'));
    expect(toast.toastError).toHaveBeenCalledWith(expect.any(ApiError), 'Load failed');
  });

  it('drops a response for an id that is no longer open', async () => {
    let releaseOld!: (r: Rec) => void;
    const load = vi.fn((rid: string) => (rid === 'old'
      ? new Promise<Rec>((r) => { releaseOld = r; })
      : Promise.resolve({ id: rid, name: 'New', note: null })));
    const { result, rerender } = setup({ load }, 'old');
    rerender({ id: 'new' });
    await waitFor(() => expect(result.current.record?.name).toBe('New'));
    await act(async () => { releaseOld({ id: 'old', name: 'Old', note: null }); });
    expect(result.current.record?.name).toBe('New');
    expect(result.current.form.name).toBe('New');
  });

  it('runs onLoaded with the record', async () => {
    const onLoaded = vi.fn();
    const { result } = setup({ onLoaded });
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(onLoaded).toHaveBeenCalledWith(expect.objectContaining({ id: 'r1' }));
  });
});

describe('useRecordForm dirty and reset', () => {
  it('is dirty after an edit and clean after reset, which also clears field errors', async () => {
    const { result } = setup({ save: vi.fn(async () => { throw new ApiError('bad', 400); }) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ ...result.current.form, name: 'Gaya' }));
    expect(result.current.dirty).toBe(true);
    act(() => result.current.setFieldErrors({ name: 'Taken' }));
    act(() => result.current.reset());
    expect(result.current.dirty).toBe(false);
    expect(result.current.form.name).toBe('Patna');
    expect(result.current.fieldErrors).toEqual({});
  });
});

describe('useRecordForm save', () => {
  it('saves the form, toasts, re-reads and is clean with the server values', async () => {
    let n = 0;
    const load = vi.fn(async (rid: string): Promise<Rec> => ({ id: rid, name: n++ === 0 ? 'Patna' : 'GAYA', note: null }));
    const { result, save } = setup({ load });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ ...result.current.form, name: 'Gaya' }));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(true);
    expect(save).toHaveBeenCalledWith('r1', { name: 'Gaya', note: '' }, expect.objectContaining({ base: { name: 'Patna', note: '' } }));
    expect(toast.toast).toHaveBeenCalledWith('Saved');
    expect(load).toHaveBeenCalledTimes(2);
    expect(result.current.form.name).toBe('GAYA');
    expect(result.current.dirty).toBe(false);
    expect(result.current.saving).toBe(false);
  });

  it('a failed save keeps the edits, shows field errors and toasts', async () => {
    const err = new ApiError('bad', 400);
    const save = vi.fn(async () => { throw err; });
    const { result } = setup({ save });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ ...result.current.form, name: 'Gaya' }));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(false);
    expect(toast.toastError).toHaveBeenCalledWith(err, 'Save failed');
    expect(result.current.dirty).toBe(true);
    expect(result.current.form.name).toBe('Gaya');
  });

  it('maps server field errors', async () => {
    const err = new ApiError('bad', 400, 'VALIDATION', [{ field: 'name', message: 'Taken' }]);
    const { result } = setup({ save: vi.fn(async () => { throw err; }) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.save(); });
    expect(result.current.fieldErrors).toEqual({ name: 'Taken' });
  });

  it('save returning false aborts without the success toast', async () => {
    const { result } = setup({ save: vi.fn(async () => false as const) });
    await waitFor(() => expect(result.current.loading).toBe(false));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(false);
    expect(toast.toast).not.toHaveBeenCalled();
  });

  it('canSave false skips the save', async () => {
    const { result, save } = setup({ canSave: (f) => f.name.trim() !== '' });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ ...result.current.form, name: ' ' }));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(false);
    expect(save).not.toHaveBeenCalled();
  });

  it('a saved message function gets the submitted form and the base', async () => {
    const saved = vi.fn(() => 'Custom');
    const { result } = setup({ messages: { loadFailed: 'x', saveFailed: 'y', saved } });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ ...result.current.form, note: 'n' }));
    await act(async () => { await result.current.save(); });
    expect(saved).toHaveBeenCalledWith({ name: 'Patna', note: 'n' }, { name: 'Patna', note: '' });
    expect(toast.toast).toHaveBeenCalledWith('Custom');
  });

  it('edits typed while saving stay on screen and stay dirty (the re-read does not overwrite them)', async () => {
    let release!: () => void;
    const save = vi.fn(() => new Promise<void>((r) => { release = r; }));
    let n = 0;
    const load = vi.fn(async (rid: string): Promise<Rec> => ({ id: rid, name: n++ === 0 ? 'Patna' : 'Gaya', note: null }));
    const { result } = setup({ save, load });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ name: 'Gaya', note: '' }));
    let saving!: Promise<boolean>;
    act(() => { saving = result.current.save(); });
    expect(result.current.saving).toBe(true);
    act(() => result.current.setForm({ name: 'Gaya', note: 'typed meanwhile' }));
    await act(async () => { release(); await saving; });
    expect(result.current.form).toEqual({ name: 'Gaya', note: 'typed meanwhile' });
    expect(result.current.dirty).toBe(true);
    // The submitted values are the baseline: undoing the extra edit is clean again.
    act(() => result.current.setForm({ name: 'Gaya', note: '' }));
    expect(result.current.dirty).toBe(false);
    expect(result.current.record?.name).toBe('Gaya');
  });

  it('a failed re-read after a good save still succeeds with the submitted baseline', async () => {
    let n = 0;
    const load = vi.fn(async (rid: string): Promise<Rec> => {
      if (n++ > 0) throw new Error('down');
      return { id: rid, name: 'Patna', note: null };
    });
    const { result } = setup({ load });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ name: 'Gaya', note: '' }));
    let ok!: boolean;
    await act(async () => { ok = await result.current.save(); });
    expect(ok).toBe(true);
    expect(result.current.dirty).toBe(false);
    expect(result.current.form.name).toBe('Gaya');
  });

  it('ctx.setSaved lets a partial save keep the unsaved part dirty', async () => {
    const save = vi.fn(async (_id: string, submitted: Form, ctx: { base: Form; setSaved: (f: Form) => void }) => {
      ctx.setSaved({ ...submitted, note: ctx.base.note });
      return false as const;
    });
    const { result } = setup({ save });
    await waitFor(() => expect(result.current.loading).toBe(false));
    act(() => result.current.setForm({ name: 'Gaya', note: 'n' }));
    await act(async () => { await result.current.save(); });
    act(() => result.current.setForm({ name: 'Gaya', note: '' }));
    expect(result.current.dirty).toBe(false);
  });
});
