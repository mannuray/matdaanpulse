// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, cleanup } from '@testing-library/react';
vi.mock('../../services/media.service', () => ({ uploadImage: vi.fn() }));
import { uploadImage } from '../../services/media.service';
import { ImageUpload, fileNameOf } from './ImageUpload';
import { ApiError } from '../../services/api-client';

afterEach(() => { cleanup(); vi.clearAllMocks(); });
const png = () => new File(['x'], 'logo.png', { type: 'image/png' });

describe('ImageUpload', () => {
  it('uploads the picked file and reports the new URL', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ url: 'https://b/new.png', pathname: 'p', content_type: 'image/png', size: 1 });
    const onChange = vi.fn();
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="/symbols/logos/BJP.svg" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Upload Party logo'), { target: { files: [png()] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/new.png'));
    expect(uploadImage).toHaveBeenCalledWith(expect.any(File), 'party-logo', 'BJP');
  });

  it('keeps the old image and shows the error when the upload fails', async () => {
    vi.mocked(uploadImage).mockRejectedValue(new ApiError('Image is too large (max 1 MB)', 413));
    const onChange = vi.fn();
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="https://b/old.png" onChange={onChange} />);
    fireEvent.change(screen.getByLabelText('Upload Party logo'), { target: { files: [png()] } });
    expect(await screen.findByText('Image is too large (max 1 MB)')).toBeTruthy();
    expect(onChange).not.toHaveBeenCalled();
    expect(screen.getByRole('img').getAttribute('src')).toBe('https://b/old.png');
  });

  it('rejects a wrong type before uploading', async () => {
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="" onChange={vi.fn()} />);
    fireEvent.change(screen.getByLabelText('Upload Party logo'), { target: { files: [new File(['x'], 'a.gif', { type: 'image/gif' })] } });
    expect(await screen.findByText(/PNG, JPEG, WebP or SVG/)).toBeTruthy();
    expect(uploadImage).not.toHaveBeenCalled();
  });

  it('Remove clears the URL; no Remove when empty', () => {
    const onChange = vi.fn();
    const { rerender } = render(<ImageUpload label="ECI symbol" kind="party-eci" ownerId="BJP" url="https://b/x.svg" onChange={onChange} />);
    fireEvent.click(screen.getByRole('button', { name: 'Remove ECI symbol' }));
    expect(onChange).toHaveBeenCalledWith('');
    rerender(<ImageUpload label="ECI symbol" kind="party-eci" ownerId="BJP" url="" onChange={onChange} />);
    expect(screen.queryByRole('button', { name: 'Remove ECI symbol' })).toBeNull();
  });

  it('accepts a dropped file', async () => {
    vi.mocked(uploadImage).mockResolvedValue({ url: 'https://b/d.png', pathname: 'p', content_type: 'image/png', size: 1 });
    const onChange = vi.fn();
    render(<ImageUpload label="Party logo" kind="party-logo" ownerId="BJP" url="" onChange={onChange} />);
    fireEvent.drop(screen.getByTestId('image-drop'), { dataTransfer: { files: [png()] } });
    await waitFor(() => expect(onChange).toHaveBeenCalledWith('https://b/d.png'));
  });

  it('fileNameOf strips the Blob random suffix-free path to its last segment', () => {
    expect(fileNameOf('/symbols/logos/BJP.svg')).toBe('BJP.svg');
    expect(fileNameOf('https://x.public.blob.vercel-storage.com/parties/BJP/logo-Ab12.png')).toBe('logo-Ab12.png');
  });
});
