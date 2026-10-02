import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { sniffImage, validateUpload, MAX_BYTES, blobPath } from './media-validation';

const PNG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0]);
const JPG = Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0x10]);
const WEBP = Buffer.concat([Buffer.from('RIFF'), Buffer.from([0, 0, 0, 0]), Buffer.from('WEBPVP8 ')]);
const svg = (s: string) => Buffer.from(s, 'utf8');
const seedSvg = readFileSync(join(__dirname, '../../../../frontend/public/symbols/logos/BJP.svg'));
const file = (buffer: Buffer) => ({ buffer, size: buffer.length });

describe('sniffImage', () => {
  it.each([
    ['png', PNG, 'image/png'],
    ['jpg', JPG, 'image/jpeg'],
    ['webp', WEBP, 'image/webp'],
  ])('detects %s', (ext, buf, type) => expect(sniffImage(buf)).toEqual({ ext, contentType: type }));

  it('detects a real seed SVG', () => expect(sniffImage(seedSvg)?.ext).toBe('svg'));
  it.each([
    '<svg xmlns="http://www.w3.org/2000/svg"></svg>',
    '﻿<?xml version="1.0"?>\n<!-- logo -->\n<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x">\n<svg viewBox="0 0 1 1"/>',
    '   \n<svg>',
    '<?xml version="1.0"?>\n<!DOCTYPE svg [ <!ENTITY a "b"> ]>\n<svg/>',
    '<!-- a - b -- c --><svg/>',
  ])('accepts SVG with prolog variants: %#', (s) => expect(sniffImage(svg(s))).toEqual({ ext: 'svg', contentType: 'image/svg+xml' }));

  it.each([
    ['html', svg('<!doctype html><html><script>alert(1)</script>')],
    ['js', svg('alert(1)')],
    ['empty', Buffer.alloc(0)],
    ['svg-after-html', svg('<html><svg></svg></html>')],
  ])('rejects %s', (_n, buf) => expect(sniffImage(buf)).toBeNull());

  it('rejects many empty comments in linear time (no ReDoS)', () => {
    const start = Date.now();
    expect(sniffImage(svg('<!---->'.repeat(600) + 'x'))).toBeNull();
    expect(Date.now() - start).toBeLessThan(50);
  });
});

describe('validateUpload', () => {
  it('returns type and path for a valid party logo', () => {
    expect(validateUpload(file(PNG), 'party-logo', 'BJP')).toEqual({ ext: 'png', contentType: 'image/png', path: 'parties/BJP/logo.png' });
  });
  it('person photo path', () => {
    expect(validateUpload(file(JPG), 'person-photo', '6a14c00a-1b2c-4d5e-8f90-123456789abc').path)
      .toBe('persons/6a14c00a-1b2c-4d5e-8f90-123456789abc/photo.jpg');
  });
  it('rejects a missing file', () => expect(() => validateUpload(undefined, 'party-logo', 'BJP')).toThrow(BadRequestException));
  it('rejects a spoofed type', () => expect(() => validateUpload(file(svg('<html>')), 'party-eci', 'BJP')).toThrow(/PNG, JPEG, WebP or SVG/));
  it('rejects an unknown kind', () => expect(() => validateUpload(file(PNG), 'banner' as any, 'BJP')).toThrow(BadRequestException));
  it.each(['', 'x'.repeat(65)])('rejects owner id %p', (id) =>
    expect(() => validateUpload(file(PNG), 'party-logo', id)).toThrow(BadRequestException));
  it('accepts a party id with punctuation and sanitises it for the path', () => {
    expect(validateUpload(file(PNG), 'party-logo', 'JD(U)').path).toBe('parties/JD_U_/logo.png');
  });
  it.each(['../x', 'a/b', '..\\..\\x'])('owner id %p cannot traverse the blob path', (id) => {
    const owner = validateUpload(file(PNG), 'party-logo', id).path.split('/')[1];
    expect(owner).not.toMatch(/\.\.|[/\\]/);
  });
  it('size limit is per kind', () => {
    const big = { buffer: PNG, size: MAX_BYTES['party-logo'] + 1 };
    expect(() => validateUpload(big, 'party-logo', 'BJP')).toThrow(PayloadTooLargeException);
    expect(validateUpload(big, 'person-photo', 'p1').ext).toBe('png');
  });
  it('blobPath', () => expect(blobPath('party-eci', 'AAP', 'svg')).toBe('parties/AAP/eci.svg'));
});
