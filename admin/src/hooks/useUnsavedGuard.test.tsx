// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { ShellStatusProvider, useShellStatus, DISCARD_EDITS_PROMPT } from '../context/ShellStatusContext';
import { useUnsavedGuard } from './useUnsavedGuard';

afterEach(cleanup);

function Probe() { return <output data-testid="dirty">{String(useShellStatus().editorDirty)}</output>; }
function Guarded({ dirty }: { dirty: boolean }) { useUnsavedGuard(dirty); return null; }
const unload = () => { const e = new Event('beforeunload', { cancelable: true }); window.dispatchEvent(e); return e.defaultPrevented; };

describe('useUnsavedGuard', () => {
  it('reports dirty to the shell, arms the tab-close warning, and clears both on unmount', () => {
    const { rerender } = render(<ShellStatusProvider><Guarded dirty={false} /><Probe /></ShellStatusProvider>);
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(unload()).toBe(false);
    rerender(<ShellStatusProvider><Guarded dirty /><Probe /></ShellStatusProvider>);
    expect(screen.getByTestId('dirty').textContent).toBe('true');
    expect(unload()).toBe(true);
    rerender(<ShellStatusProvider><Probe /></ShellStatusProvider>);
    expect(screen.getByTestId('dirty').textContent).toBe('false');
    expect(unload()).toBe(false);
  });

  it('uses one generic prompt for seats and records', () => {
    expect(DISCARD_EDITS_PROMPT).toBe('Discard unsaved changes?');
  });
});
