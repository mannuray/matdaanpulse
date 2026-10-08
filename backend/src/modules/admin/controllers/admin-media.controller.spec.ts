import { Reflector } from '@nestjs/core';
import { ROLES_KEY } from '../../auth/decorators/roles.decorator';
import { AdminMediaController } from './admin-media.controller';

describe('AdminMediaController', () => {
  it('is limited to SUPER_ADMIN and EDITOR', () => {
    const roles = new Reflector().get(ROLES_KEY, AdminMediaController.prototype.upload);
    expect(roles).toEqual(['SUPER_ADMIN', 'EDITOR']);
  });
  it('passes the file, kind and owner id to the service', async () => {
    const media = { upload: jest.fn().mockResolvedValue({ url: 'u' }) };
    const file = { buffer: Buffer.from('x'), size: 1 } as any;
    await new AdminMediaController(media as any, { log: jest.fn() } as any).upload(file, { kind: 'person-photo', owner_id: 'p1' }, { user: { id: 'u1' } });
    expect(media.upload).toHaveBeenCalledWith(file, 'person-photo', 'p1');
  });
  it('writes a MEDIA_UPLOAD audit row (U2)', async () => {
    const out = { url: 'https://cdn/persons/p1/photo-ab.jpg', pathname: 'persons/p1/photo-ab.jpg', content_type: 'image/jpeg', size: 10 };
    const audit = { log: jest.fn(async () => undefined) };
    const file = { buffer: Buffer.from('x'), size: 10 } as any;
    await new AdminMediaController({ upload: jest.fn().mockResolvedValue(out) } as any, audit as any)
      .upload(file, { kind: 'person-photo', owner_id: 'p1' }, { user: { id: 'u1' } });
    expect(audit.log).toHaveBeenCalledWith({
      userId: 'u1', action: 'MEDIA_UPLOAD', entityType: 'media', entityId: 'persons/p1/photo-ab.jpg',
      newValue: { kind: 'person-photo', owner_id: 'p1', url: out.url, content_type: 'image/jpeg', size: 10 },
    });
  });
});
