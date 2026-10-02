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
    fireEvent.change(screen.getByLabelText('Photo file of Nitish Kumar'), { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/new.jpg'));
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), 'person-photo', 'p1');
  });

  it('clicking the photo opens the file chooser (Change when set, Upload when empty)', () => {
    const { rerender } = render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="https://b/p.jpg" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Photo file of Nitish Kumar') as HTMLInputElement;
    expect(input.tabIndex).toBe(-1);
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Change photo of Nitish Kumar' }));
    expect(click).toHaveBeenCalledTimes(1);
    rerender(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={vi.fn()} />);
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo of Nitish Kumar' }));
    expect(click).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('the corner x removes without opening the chooser; absent when empty', () => {
    const onChange = vi.fn();
    const { rerender } = render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="https://b/p.jpg" onChange={onChange} />);
    const click = vi.spyOn(screen.getByLabelText('Photo file of Nitish Kumar') as HTMLInputElement, 'click').mockImplementation(() => {});
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo of Nitish Kumar' }));
    expect(onChange).toHaveBeenCalledWith('');
    expect(click).not.toHaveBeenCalled();
    rerender(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Remove photo of Nitish Kumar' })).toBeNull();
  });

  it('the note is a tooltip and the accessible description of the photo button', () => {
    render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={vi.fn()} note="Updates every contest" />);
    const btn = screen.getByRole('button', { name: 'Upload photo of Nitish Kumar' });
    expect(btn.getAttribute('title')).toBe('Updates every contest');
    expect(document.getElementById(btn.getAttribute('aria-describedby')!)?.textContent).toBe('Updates every contest');
  });

  it('while uploading the photo button shows a spinner and ignores clicks', async () => {
    let resolve!: (v: any) => void;
    vi.mocked(uploadImage).mockReturnValue(new Promise((r) => { resolve = r; }));
    render(<PhotoButton name="Nitish Kumar" ownerId="p1" url="" onChange={vi.fn()} />);
    const input = screen.getByLabelText('Photo file of Nitish Kumar') as HTMLInputElement;
    fireEvent.change(input, { target: { files: [new File(['x'], 'p.jpg', { type: 'image/jpeg' })] } });
    const btn = screen.getByRole('button', { name: 'Upload photo of Nitish Kumar' });
    expect(screen.getByRole('status', { name: 'Uploading' })).toBeTruthy();
    expect(btn.getAttribute('aria-disabled')).toBe('true');
    expect(btn.hasAttribute('disabled')).toBe(false);
    const click = vi.spyOn(input, 'click').mockImplementation(() => {});
    fireEvent.click(btn);
    expect(click).not.toHaveBeenCalled();
    resolve({ url: 'https://b/1.jpg', pathname: 'p', content_type: 'image/jpeg', size: 1 });
    await waitFor(() => expect(screen.queryByRole('status')).toBeNull());
  });

  it('shows an external error', () => {
    render(<PhotoButton name="N" ownerId="p1" url="" onChange={vi.fn()} error="Photo not saved" />);
    expect(screen.getByRole('alert').textContent).toBe('Photo not saved');
  });
});
