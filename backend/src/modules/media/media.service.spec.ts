import { MediaNotConfiguredException, MediaStorageFailedException } from '../../common/exceptions';
const send = jest.fn();
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn(() => ({ send })),
  PutObjectCommand: jest.fn((input) => ({ input })),
}));
import { MediaService } from './media.service';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 1, 2]);
const S3 = { S3_BUCKET: 'matdaanpulse-media', S3_REGION: 'ap-south-1', S3_PUBLIC_BASE_URL: 'https://matdaanpulse-media.s3.ap-south-1.amazonaws.com' };
const config = (env: Record<string, string> = {}) => ({ get: jest.fn((k: string) => env[k]) }) as any;

describe('MediaService (S3)', () => {
  afterEach(() => jest.clearAllMocks());

  it('503 when the S3 bucket is not configured (before touching the file)', async () => {
    await expect(new MediaService(config()).upload(undefined, 'party-logo', 'BJP')).rejects.toThrow(MediaNotConfiguredException);
    expect(send).not.toHaveBeenCalled();
  });

  it('puts a public object under a randomly suffixed key with the sniffed content type', async () => {
    send.mockResolvedValue({});
    const out = await new MediaService(config(S3)).upload({ buffer: PNG, size: PNG.length }, 'party-logo', 'BJP');
    const input = send.mock.calls[0][0].input;
    expect(input).toMatchObject({ Bucket: 'matdaanpulse-media', Body: PNG, ContentType: 'image/png' });
    expect(input.Key).toMatch(/^parties\/BJP\/logo-[0-9a-f]{8}\.png$/);
    expect(out).toEqual({ url: `${S3.S3_PUBLIC_BASE_URL}/${input.Key}`, pathname: input.Key, content_type: 'image/png', size: PNG.length });
  });

  it('502 MEDIA_0002 when S3 fails, keeping the original error as cause', async () => {
    const boom = new Error('s3 down');
    send.mockRejectedValue(boom);
    const err = await new MediaService(config(S3)).upload({ buffer: PNG, size: PNG.length }, 'party-logo', 'BJP').catch((e) => e);
    expect(err).toBeInstanceOf(MediaStorageFailedException);
    expect(err.getStatus()).toBe(502);
    expect(err.code).toBe('MEDIA_0002');
    expect(err.cause).toBe(boom);
  });

  it('validation errors are not wrapped as storage failures', async () => {
    await expect(new MediaService(config(S3)).upload(undefined, 'party-logo', 'BJP')).rejects.toThrow('Choose an image file');
    expect(send).not.toHaveBeenCalled();
  });
});
