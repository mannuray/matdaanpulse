// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { memo, useEffect } from 'react';
import { act, cleanup, render, screen } from '@testing-library/react';
import { ShellStatusProvider } from './ShellStatusContext';
import { useLiveStatus, type LiveStreamState } from './LiveStatusContext';
import { useUnsavedEdits } from './UnsavedEditsContext';

afterEach(cleanup);

const renders = { live: 0, edits: 0 };
let setLive!: (s: LiveStreamState) => void;
let markDirty!: (owner: string, dirty: boolean) => void;

const LiveReader = memo(function LiveReader() {
  const s = useLiveStatus();
  renders.live++;
  setLive = s.setLive;
  return <output data-testid="live">{s.live}</output>;
});
const EditsReader = memo(function EditsReader() {
  const s = useUnsavedEdits();
  renders.edits++;
  useEffect(() => { markDirty = s.markDirty; });
  return <output data-testid="dirty">{String(s.editorDirty)}</output>;
});

describe('ShellStatusProvider', () => {
  it('a live-status change does not re-render unsaved-edit readers, and the reverse', () => {
    renders.live = 0; renders.edits = 0;
    render(<ShellStatusProvider><LiveReader /><EditsReader /></ShellStatusProvider>);
    const base = { ...renders };
    act(() => setLive('open'));
    expect(screen.getByTestId('live').textContent).toBe('open');
    expect(renders.edits).toBe(base.edits);
    const afterLive = { ...renders };
    act(() => markDirty('panel', true));
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    expect(renders.live).toBe(afterLive.live);
    act(() => markDirty('panel', false));
    expect(screen.getByTestId('dirty').textContent).toBe('false');
  });

  it('editorDirty stays true while any owner is dirty', () => {
    render(<ShellStatusProvider><EditsReader /></ShellStatusProvider>);
    act(() => { markDirty('a', true); markDirty('b', true); });
    act(() => markDirty('a', false));
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    act(() => markDirty('b', false));
    expect(screen.getByTestId('dirty').textContent).toBe('false');
  });
});
