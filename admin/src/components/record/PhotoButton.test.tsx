// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { cleanup, render, screen, fireEvent, waitFor } from '@testing-library/react';
vi.mock('../../services/media.service', () => ({ uploadImage: vi.fn() }));
import { uploadImage } from '../../services/media.service';
import { PhotoButton } from './PhotoButton';

afterEach(() => { cleanup(); vi.clearAllMocks(); });

describe('PhotoButton', () => {
  it('shows the initial without a photo and the image with one', () => {
    const { rerender } = render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={vi.fn()} />);
    expect(screen.getByText('N')).toBeTruthy();
    rerender(<PhotoButton name="Nitish Kumar" ownerId="p1" url="https://b/p.jpg" onChange={vi.fn()} />);
    expect(screen.getByRole('img', { name: 'Nitish Kumar' }).getAttribute('src')).toBe('https://b/p.jpg');
  });

  it('upload from the hidden input reports the URL', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ url: 'https://b/new.jpg', pathname: 'p', content_type: 'image/jpeg', size: 1 });
    const onChange = vi.fn();
    render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Upload photo of Nitish Kumar'), { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/new.jpg'));
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), 'person-photo', 'p1');
  });

  it('menu: Remove clears; note is shown', async () => {
    const onChange = vi.fn();
    render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="https://b/p.jpg" onChange={onChange} note="Updates every contest" />);
    fireEvent.pointerDown(screen.getByRole('button', { name: 'Change photo of Nitish Kumar' }), { button: 0, ctrlKey: false });
    expect(await screen.findByText('Updates every contest')).toBeTruthy();
    fireEvent.click(await screen.findByRole('menuitem', { name: 'Remove' }));
    expect(onChange).toHaveBeenCalledWith('');
  });

  it('shows an external error', () => {
    render(<PhotoButton name="N" ownerId="p1" url="" onChange={vi.fn()} error="Photo not saved" />);
    expect(screen.getByRole('alert').textContent).toBe('Photo not saved');
  });
});
