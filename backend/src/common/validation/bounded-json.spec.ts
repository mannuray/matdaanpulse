import { BadRequestException } from '@nestjs/common';
import { BoundedJsonObjectPipe, checkBoundedJson } from './bounded-json';

describe('bounded JSON objects (U3: constituency metadata)', () => {
  const pipe = new BoundedJsonObjectPipe({ maxBytes: 1024, maxDepth: 3, maxKeys: 5 });

  it('passes a small object through unchanged', () => {
    const v = { tags: ['urban', 'swing'], note: 'x', nested: { a: { b: 1 } } };
    expect(pipe.transform(v)).toBe(v);
  });

  it('refuses non-objects', () => {
    for (const v of [null, [], 'x', 1, undefined]) expect(() => pipe.transform(v)).toThrow(BadRequestException);
  });

  it('refuses too large, too deep or too wide objects', () => {
    expect(() => pipe.transform({ a: 'x'.repeat(1100) })).toThrow(BadRequestException);
    expect(() => pipe.transform({ a: { b: { c: { d: 1 } } } })).toThrow(BadRequestException);
    expect(() => pipe.transform({ a: 1, b: 2, c: 3, d: 4, e: 5, f: 6 })).toThrow(BadRequestException);
    expect(() => pipe.transform({ a: [[[[1]]]] })).toThrow(BadRequestException);
  });

  it('checkBoundedJson reports the reason', () => {
    expect(checkBoundedJson({ a: 1 }, { maxBytes: 1024, maxDepth: 3, maxKeys: 5 })).toBeNull();
    expect(checkBoundedJson({ a: { b: { c: { d: 1 } } } }, { maxBytes: 1024, maxDepth: 3, maxKeys: 5 })).toMatch(/deep/);
  });
});

import { ValidationPipe } from '@nestjs/common';
import { UpdateConstituencyDto } from '../../modules/constituencies/dto/constituency-input.dto';

describe('UpdateConstituencyDto.metadata is bounded (U3)', () => {
  const vp = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });
  const body = (value: unknown) => vp.transform(value, { type: 'body', metatype: UpdateConstituencyDto });
  it('accepts small metadata and refuses oversized or deep metadata', async () => {
    await expect(body({ metadata: { tags: ['swing'] } })).resolves.toBeDefined();
    await expect(body({ metadata: { a: 'x'.repeat(20_000) } })).rejects.toBeInstanceOf(BadRequestException);
    await expect(body({ metadata: { a: { b: { c: { d: { e: 1 } } } } } })).rejects.toBeInstanceOf(BadRequestException);
  });
});
