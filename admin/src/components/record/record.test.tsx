// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { RecordPage } from './RecordPage';
import { RecordCard, RecordMeta } from './RecordCard';

afterEach(cleanup);

const base = {
  backLabel: 'Parties', onBack: vi.fn(), title: 'Bharatiya Janata Party', dirty: false, saving: false,
  onCancel: vi.fn(), onSave: vi.fn(), main: <input aria-label="Name" />, aside: <div>related</div>,
};

describe('RecordPage', () => {
  it('lets the header wrap and puts headerActions before Cancel', () => {
    render(<RecordPage {...base} headerActions={<button>Merge</button>} />);
    const header = screen.getByRole('banner');
    expect(header.className).toContain('flex-wrap');
    const names = screen.getAllByRole('button').map((b) => b.textContent);
    expect(names.indexOf('Merge')).toBeLessThan(names.indexOf('Cancel'));
  });

  it('disables Save when clean or when canSave is false', () => {
    const { rerender } = render(<RecordPage {...base} />);
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
    rerender(<RecordPage {...base} dirty />);
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(false);
    rerender(<RecordPage {...base} dirty canSave={false} />);
    expect((screen.getByRole('button', { name: 'Save changes' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('Cancel calls onCancel and the back link calls onBack', () => {
    const onCancel = vi.fn(); const onBack = vi.fn();
    render(<RecordPage {...base} dirty onCancel={onCancel} onBack={onBack} />);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    fireEvent.click(screen.getByRole('button', { name: /Parties/ }));
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('Enter in a main input saves only when dirty', () => {
    const onSave = vi.fn();
    const { rerender } = render(<RecordPage {...base} onSave={onSave} />);
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });
    expect(onSave).not.toHaveBeenCalled();
    rerender(<RecordPage {...base} dirty onSave={onSave} />);
    fireEvent.keyDown(screen.getByLabelText('Name'), { key: 'Enter' });
    expect(onSave).toHaveBeenCalledTimes(1);
  });

  it('shows the dirty status, and loading or error instead of the body', () => {
    const { rerender } = render(<RecordPage {...base} dirty />);
    expect(screen.getByText('Unsaved changes')).toBeTruthy();
    rerender(<RecordPage {...base} error={<p>Could not load</p>} />);
    expect(screen.getByText('Could not load')).toBeTruthy();
    expect(screen.queryByText('related')).toBeNull();
  });
});

describe('RecordCard', () => {
  it('renders title, subtitle, action and children', () => {
    render(<RecordCard title="Identity" subtitle="Who they are" action={<button>Edit</button>}>body</RecordCard>);
    expect(screen.getByRole('heading', { name: 'Identity' })).toBeTruthy();
    expect(screen.getByText('Who they are')).toBeTruthy();
    expect(screen.getByText('body')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Edit' })).toBeTruthy();
  });
});

describe('RecordMeta', () => {
  it('shows "No edits recorded" for a null last_edit', () => {
    render(<RecordMeta id="BJP" lastEdit={null} />);
    expect(screen.getByText('No edits recorded')).toBeTruthy();
    expect(screen.getByText('BJP')).toBeTruthy();
  });

  it('shows the editor and IST time', () => {
    render(<RecordMeta id="BJP" updatedAt="2026-10-02T09:02:00Z" lastEdit={{ at: '2026-10-02T09:02:00Z', by: 'Mannu K' }} />);
    expect(screen.getByText('Mannu K · 02 Oct 2026, 14:32')).toBeTruthy();
    expect(screen.getByText('02 Oct 2026, 14:32')).toBeTruthy();
  });

  it('copies the id', async () => {
    const writeText = vi.fn(async () => {});
    Object.assign(navigator, { clipboard: { writeText } });
    render(<RecordMeta id="BJP" />);
    fireEvent.click(screen.getByRole('button', { name: 'Copy id' }));
    expect(writeText).toHaveBeenCalledWith('BJP');
  });
});
