import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { UpdatePartyDto } from '../../modules/parties/dto/party-input.dto';
import { UpdatePersonDto } from '../../modules/candidates/dto/person-input.dto';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const body = (metatype: any, value: Record<string, unknown>) => pipe.transform(value, { type: 'body', metatype });

describe('admin DTO URL fields (S-M2)', () => {
  it.each(['photo_url', 'wikipedia_url'])('person %s rejects javascript: URLs', async (field) => {
    await expect(body(UpdatePersonDto, { [field]: 'javascript:alert(1)' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it.each(['website', 'wikipedia_url'])('party %s rejects non-http(s) and over-long URLs', async (field) => {
    await expect(body(UpdatePartyDto, { [field]: 'data:text/html,x' })).rejects.toBeInstanceOf(BadRequestException);
    await expect(body(UpdatePartyDto, { [field]: `https://e.com/${'a'.repeat(2050)}` })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts https URLs and turns empty strings into null', async () => {
    await expect(body(UpdatePersonDto, { photo_url: 'https://upload.wikimedia.org/x.jpg', wikipedia_url: '' }))
      .resolves.toMatchObject({ photo_url: 'https://upload.wikimedia.org/x.jpg', wikipedia_url: null });
    await expect(body(UpdatePartyDto, { website: 'https://bjp.org', wikipedia_url: null })).resolves.toBeDefined();
  });

  it('party symbol URLs may be site-relative paths but not javascript:', async () => {
    await expect(body(UpdatePartyDto, { symbol_url: '/symbols/logos/BJP.svg', eci_symbol_url: '/symbols/eci/BJP.svg' })).resolves.toBeDefined();
    await expect(body(UpdatePartyDto, { symbol_url: 'javascript:alert(1)' })).rejects.toBeInstanceOf(BadRequestException);
  });
});

import { BulkTagDto } from '../../modules/constituencies/dto/constituency-input.dto';

describe('id-array caps fit the 100 kb body limit (review M8)', () => {
  it('rejects more than 2000 ids with 400, and 2000 UUIDs fit in 100 kb', async () => {
    const uuid = 'b2c3d4e5-f6a7-8901-bcde-f12345678901';
    await expect(body(BulkTagDto, { ids: Array(2001).fill('BR_VS_1_X') })).rejects.toBeInstanceOf(BadRequestException);
    await expect(body(BulkTagDto, { ids: Array(2000).fill('BR_VS_1_X') })).resolves.toBeDefined();
    expect(JSON.stringify({ ids: Array(2000).fill(uuid) }).length).toBeLessThan(100 * 1024);
  });
});

import { LoginDto, RegisterDto } from '../../modules/auth/dto/auth.dto';
import { CreateUserDto, UpdateUserDto } from '../../modules/admin/dto/user.dto';

describe("password fields stop at bcrypt's 72-byte limit (U7)", () => {
  const base: Record<string, Record<string, unknown>> = {
    LoginDto: { email: 'a@b.co' },
    RegisterDto: { email: 'a@b.co', name: 'A' },
    CreateUserDto: { email: 'a@b.co', name: 'A', role: 'EDITOR' },
    UpdateUserDto: {},
  };
  const dtos: Record<string, unknown> = { LoginDto, RegisterDto, CreateUserDto, UpdateUserDto };
  it.each(Object.keys(dtos))('%s accepts 72 chars and rejects 73 chars or more than 72 bytes', async (name) => {
    const dto = dtos[name];
    await expect(body(dto, { ...base[name], password: 'a'.repeat(72) })).resolves.toBeDefined();
    await expect(body(dto, { ...base[name], password: 'a'.repeat(73) })).rejects.toBeInstanceOf(BadRequestException);
    // 30 three-byte characters = 90 bytes: bcrypt would silently ignore the tail.
    await expect(body(dto, { ...base[name], password: 'अ'.repeat(30) })).rejects.toBeInstanceOf(BadRequestException);
  });
});
