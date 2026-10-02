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
    await new AdminMediaController(media as any).upload(file, { kind: 'person-photo', owner_id: 'p1' });
    expect(media.upload).toHaveBeenCalledWith(file, 'person-photo', 'p1');
  });
});
