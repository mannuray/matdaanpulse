import { BadRequestException, ValidationPipe } from '@nestjs/common';

const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
const body = (metatype: any, value: Record<string, unknown>) => pipe.transform(value, { type: 'body', metatype });

import { LoginDto, RegisterDto } from '../../auth/dto/auth.dto';
import { CreateUserDto, UpdateUserDto } from './user.dto';

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
