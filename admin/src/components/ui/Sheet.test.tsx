// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { Sheet } from './Sheet';
import { ConfirmDialog } from './ConfirmDialog';

afterEach(cleanup);

function Page({ onRequestClose, open = true }: { onRequestClose: () => void; open?: boolean }) {
  return (
    <div className="relative flex">
      <button type="button">Row in the table</button>
      <Sheet open={open} onRequestClose={onRequestClose} title="Bharatiya Janata Party" description="Party · BJP">
        <input aria-label="Name" defaultValue="BJP" />
        <input aria-label="Seat" aria-expanded="true" role="combobox" />
      </Sheet>
    </div>
  );
}

describe('Sheet', () => {
  it('renders in place as a named, non-modal dialog; the table beside it stays usable', () => {
    render(<Page onRequestClose={vi.fn()} />);
    const dialog = screen.getByRole('dialog', { name: 'Bharatiya Janata Party' });
    expect(dialog.className).toContain('w-[400px]');
    expect(dialog.className).toContain('tw-ui');
    const row = screen.getByRole('button', { name: 'Row in the table' });
    expect(row.closest('[aria-hidden="true"]')).toBeNull();
  });

  it('a pointer-down outside is prevented from dismissing; Esc and the close button close', async () => {
    const onRequestClose = vi.fn();
    render(<Page onRequestClose={onRequestClose} />);
    // Radix registers its outside-pointer listener in setTimeout(0).
    await act(async () => { await new Promise((r) => setTimeout(r, 0)); });
    const row = screen.getByRole('button', { name: 'Row in the table' });
    const Ev = typeof PointerEvent === 'function' ? PointerEvent : MouseEvent;
    const down = new Ev('pointerdown', { bubbles: true, cancelable: true });
    act(() => { row.dispatchEvent(down); });
    fireEvent.click(row);
    expect(screen.getByRole('dialog', { name: 'Bharatiya Janata Party' })).toBeTruthy();
    expect(onRequestClose).not.toHaveBeenCalled();
    fireEvent.keyDown(document.body, { key: 'Escape' });
    expect(onRequestClose).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Close panel' }));
    expect(onRequestClose).toHaveBeenCalledTimes(2);
  });

  it('Esc inside an open combobox only closes that list', () => {
    const onRequestClose = vi.fn();
    render(<Page onRequestClose={onRequestClose} />);
    const seat = screen.getByLabelText('Seat');
    seat.focus();
    fireEvent.keyDown(seat, { key: 'Escape' });
    expect(onRequestClose).not.toHaveBeenCalled();
  });

  it('renders nothing when closed; the full width covers the page body', () => {
    const { rerender } = render(<Page onRequestClose={vi.fn()} open={false} />);
    expect(screen.queryByRole('dialog')).toBeNull();
    rerender(<Sheet open onRequestClose={vi.fn()} title="Manifest" width="full"><button type="button">Inside</button></Sheet>);
    expect(screen.getByRole('dialog', { name: 'Manifest' }).className).toContain('inset-0');
  });

});

describe('ConfirmDialog', () => {
  it('confirms and cancels', () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog open title="Finalize election?" description="This cannot be undone." confirmLabel="Yes, finalize" onConfirm={onConfirm} onCancel={onCancel} />);
    expect(screen.getByRole('dialog', { name: 'Finalize election?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Yes, finalize' }));
    expect(onConfirm).toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onCancel).toHaveBeenCalled();
  });

  it('Esc cancels when not busy, is ignored while busy', () => {
    const onCancel = vi.fn();
    const props = { title: 'T', description: 'D', confirmLabel: 'Go', onConfirm: vi.fn(), onCancel };
    const { rerender } = render(<ConfirmDialog open {...props} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    rerender(<ConfirmDialog open busy {...props} />);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect((screen.getByRole('button', { name: 'Cancel' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Esc with a ConfirmDialog above an open Sheet cancels the dialog only', () => {
    const onRequestClose = vi.fn();
    const onCancel = vi.fn();
    render(
      <>
        <Sheet open onRequestClose={onRequestClose} title="Rec"><input aria-label="Name" /></Sheet>
        <ConfirmDialog open title="Sure?" description="D" confirmLabel="Yes" onConfirm={vi.fn()} onCancel={onCancel} />
      </>,
    );
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onRequestClose).not.toHaveBeenCalled();
  });
});
