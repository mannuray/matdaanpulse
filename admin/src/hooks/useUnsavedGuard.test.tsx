// @vitest-environment jsdom
import { describe, it, expect, afterEach } from 'vitest';
import type { ReactNode } from 'react';
import { cleanup, render, screen } from '@testing-library/react';
import { ShellStatusProvider } from '../context/ShellStatusContext';
import { useUnsavedEdits, DISCARD_EDITS_PROMPT } from '../context/UnsavedEditsContext';
import { useUnsavedGuard } from './useUnsavedGuard';

afterEach(cleanup);

function Probe() { return <output data-testid="dirty">{String(useUnsavedEdits().editorDirty)}</output>; }
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

  it('two guards do not clobber each other (mount, toggle, unmount of B while A stays dirty)', () => {
    const dirty = () => screen.getByTestId('dirty').textContent;
    const { rerender } = render(<ShellStatusProvider><Guarded dirty /><Probe /></ShellStatusProvider>);
    expect(dirty()).toBe('true');
    // B mounts clean: must not write false over A's true. Keys keep A's identity stable.
    const tree = (b: ReactNode, a = true) => <ShellStatusProvider><Guarded dirty={a} /><Probe />{b}</ShellStatusProvider>;
    rerender(tree(<Guarded key="b" dirty={false} />));
    expect(dirty()).toBe('true');
    rerender(tree(<Guarded key="b" dirty />));
    expect(dirty()).toBe('true');
    rerender(tree(<Guarded key="b" dirty={false} />));
    expect(dirty()).toBe('true');
    rerender(tree(null));
    expect(dirty()).toBe('true');
    rerender(tree(null, false));
    expect(dirty()).toBe('false');
  });

  it('uses one generic prompt for seats and records', () => {
    expect(DISCARD_EDITS_PROMPT).toBe('Discard unsaved changes?');
  });
});
