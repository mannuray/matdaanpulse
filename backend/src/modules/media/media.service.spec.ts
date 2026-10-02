import { MediaNotConfiguredException, MediaStorageFailedException } from '../../common/exceptions';
jest.mock('@vercel/blob', () => ({ put: jest.fn() }));
import { put } from '@vercel/blob';
import { MediaService } from './media.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const config = (token?: string) => ({ get: jest.fn(() => token) }) as any;

describe('MediaService', () => {
  afterEach(() => jest.clearAllMocks());

  it('503 when BLOB_READ_WRITE_TOKEN is missing (before touching the file)', async () => {
    await expect(new MediaService(config()).upload(undefined, 'party-logo', 'BJP')).rejects.toThrow(MediaNotConfiguredException);
    expect(put).not.toHaveBeenCalled();
  });

  it('puts a public, randomly suffixed blob with the sniffed content type', async () => {
    (put as jest.Mock).mockResolvedValue({ url: 'https://x.public.blob.vercel-storage.com/parties/BJP/logo-abc.png', pathname: 'parties/BJP/logo-abc.png' });
    const out = await new MediaService(config('tok')).upload({ buffer: PNG, size: PNG.length }, 'party-logo', 'BJP');
    expect(put).toHaveBeenCalledWith('parties/BJP/logo.png', PNG, { access: 'public', addRandomSuffix: true, contentType: 'image/png', token: 'tok' });
    expect(out).toEqual({ url: 'https://x.public.blob.vercel-storage.com/parties/BJP/logo-abc.png', pathname: 'parties/BJP/logo-abc.png', content_type: 'image/png', size: PNG.length });
  });

  it('502 MEDIA_0002 when the blob store fails, keeping the original error as cause', async () => {
    const boom = new Error('blob store down');
    (put as jest.Mock).mockRejectedValue(boom);
    const err = await new MediaService(config('tok')).upload({ buffer: PNG, size: PNG.length }, 'party-logo', 'BJP').catch((e) => e);
    expect(err).toBeInstanceOf(MediaStorageFailedException);
    expect(err.getStatus()).toBe(502);
    expect(err.code).toBe('MEDIA_0002');
    expect(err.message).toBe('Image storage failed');
    expect(err.cause).toBe(boom);
  });

  it('validation errors are not wrapped as storage failures', async () => {
    await expect(new MediaService(config('tok')).upload(undefined, 'party-logo', 'BJP')).rejects.toThrow('Choose an image file');
    expect(put).not.toHaveBeenCalled();
  });
});
