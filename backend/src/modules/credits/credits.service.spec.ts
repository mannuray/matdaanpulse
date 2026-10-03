import { CreditsService } from './credits.service';

describe('CreditsService.list', () => {
  it('lists credits with the person or party that uses each image', async () => {
    const prisma: any = {
      image_credits: { findMany: jest.fn().mockResolvedValue([
        { url: 'u2', source_url: 's2', author: null, licence: 'Public domain' },
        { url: 'u1', source_url: 's1', author: 'A', licence: 'CC BY 4.0' },
        { url: 'u3', source_url: 's3', author: 'B', licence: 'CC0' },
      ]) },
      persons: { findMany: jest.fn().mockResolvedValue([{ photo_url: 'u1', name: 'Tejashwi Prasad Yadav' }]) },
      parties: { findMany: jest.fn().mockResolvedValue([{ symbol_url: 'u2', eci_symbol_url: null, name: 'Rashtriya Janata Dal' }]) },
    };
    expect(await new CreditsService(prisma).list()).toEqual([
      { url: 'u3', source_url: 's3', author: 'B', licence: 'CC0', used_by: null },
      { url: 'u2', source_url: 's2', author: null, licence: 'Public domain', used_by: 'Rashtriya Janata Dal' },
      { url: 'u1', source_url: 's1', author: 'A', licence: 'CC BY 4.0', used_by: 'Tejashwi Prasad Yadav' },
    ]);
  });
});
