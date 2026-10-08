import { readFileSync } from 'fs';
import { join } from 'path';
import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';
import { readdirSync } from 'fs';
import { sniffImage, validateUpload, MAX_BYTES, blobPath, svgActiveContent } from './media-validation';

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

describe('SVG active content (U4)', () => {
  const wrap = (inner: string, attrs = '') => `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink"${attrs}>${inner}</svg>`;

  it.each([
    ['script element', wrap('<script>alert(1)</script>')],
    ['namespaced script', wrap('<svg:script>alert(1)</svg:script>')],
    ['script with spaces and case', wrap('< ScRiPt >alert(1)</script>')],
    ['onload on the root', wrap('', ' onload="alert(1)"')],
    ['onclick on a child', wrap('<rect onclick=\'alert(1)\'/>')],
    ['on* after a newline', wrap('<rect\nonmouseover="x"/>')],
    ['javascript: href', wrap('<a href="javascript:alert(1)"><rect/></a>')],
    ['entity-encoded javascript:', wrap('<a xlink:href="&#106;ava&#x73;cript&#58;alert(1)"><rect/></a>')],
    ['javascript: split by whitespace', wrap('<a href="java\tscript:alert(1)"><rect/></a>')],
    ['foreignObject', wrap('<foreignObject><body xmlns="http://www.w3.org/1999/xhtml"><img src=x onerror=alert(1)></body></foreignObject>')],
    ['iframe', wrap('<iframe src="https://evil.example"/>')],
    ['embed', wrap('<embed src="x"/>')],
    ['object', wrap('<object data="x"/>')],
    ['entity declaration', '<?xml version="1.0"?><!DOCTYPE svg [ <!ENTITY x "y"> ]>' + wrap('&x;')],
    ['external entity', '<?xml version="1.0"?><!DOCTYPE svg [ <!ENTITY x SYSTEM "file:///etc/passwd"> ]>' + wrap('<text>&x;</text>')],
    ['entity holding a script URL', '<!DOCTYPE svg [ <!ENTITY js "javascript:alert(1)"> ]>' + wrap('<a href="&js;"><rect/></a>')],
    ['nested entities (billion laughs)', '<!DOCTYPE svg [ <!ENTITY a "http://x/"> <!ENTITY b "&a;&a;"> ]>' + wrap('')],
    ['external href', wrap('<use href="https://evil.example/sprite.svg#a"/>')],
    ['external xlink:href image', wrap('<image xlink:href="http://evil.example/track.png"/>')],
    ['data:text/html href', wrap('<a href="data:text/html,<script>alert(1)</script>"><rect/></a>')],
    ['css @import', wrap('<style>@import url(https://evil.example/x.css);</style>')],
    ['css external url()', wrap('<rect style="fill:url(https://evil.example/x)"/>')],
    ['xml-stylesheet', '<?xml-stylesheet href="https://evil.example/x.css"?>' + wrap('')],
    ['animated href', wrap('<a><animate attributeName="href" values="https://evil.example"/><rect/></a>')],
    ['set to javascript', wrap('<a><set attributeName="xlink:href" to="javascript:alert(1)"/></a>')],
  ])('rejects %s', (_name, s) => {
    expect(svgActiveContent(svg(s))).not.toBeNull();
    expect(() => validateUpload(file(svg(s)), 'party-logo', 'BJP')).toThrow(BadRequestException);
  });

  it('hostile input is scanned in linear time (no ReDoS)', () => {
    const start = Date.now();
    for (const body of ['<!ENTITY a '.repeat(20) + 'a'.repeat(1_000_000), '<'.repeat(1_000_000), '<a href="'.repeat(100_000), 'url('.repeat(200_000)]) {
      svgActiveContent(svg('<svg>' + body));
    }
    expect(Date.now() - start).toBeLessThan(2000);
  });

  it('active content after the first 4 KB is still found', () => {
    const s = wrap('<rect/>'.repeat(2000) + '<script>alert(1)</script>');
    expect(() => validateUpload(file(svg(s)), 'party-logo', 'BJP')).toThrow(/script|active/i);
  });

  it.each([
    ['gradient fill url(#id)', wrap('<defs><linearGradient id="g"/></defs><rect fill="url(#g)" style="fill: url( \'#g\' )"/>')],
    ['internal use href', wrap('<defs><path id="p" d="M0 0"/></defs><use href="#p"/><use xlink:href="#p"/>')],
    ['embedded raster image', wrap('<image href="data:image/png;base64,iVBORw0KGgo="/>')],
    ['text that mentions on= and script', wrap('<text>Vote on=day; no script here</text>')],
    ['Illustrator namespace entities', '<!DOCTYPE svg PUBLIC "-//W3C//DTD SVG 1.1//EN" "x" [\n\t<!ENTITY ns_ai "http://ns.adobe.com/AdobeIllustrator/10.0/">\n]>' + wrap('<rect/>', ' xmlns:i="&ns_ai;"')],
    ['xmlns declarations', wrap('<rect/>', ' xmlns:sodipodi="http://sodipodi.sourceforge.net/DTD/sodipodi-0.dtd" version="1.1"')],
  ])('accepts %s', (_name, s) => {
    expect(svgActiveContent(svg(s))).toBeNull();
    expect(validateUpload(file(svg(s)), 'party-logo', 'BJP').ext).toBe('svg');
  });

  it('every committed party symbol SVG passes', () => {
    const root = join(__dirname, '../../../../frontend/public/symbols');
    const files = ['logos', 'eci'].flatMap((d) => readdirSync(join(root, d)).filter((f) => f.endsWith('.svg')).map((f) => join(root, d, f)));
    expect(files.length).toBeGreaterThan(100);
    const flagged = files.map((f) => [f, svgActiveContent(readFileSync(f))]).filter(([, why]) => why);
    expect(flagged).toEqual([]);
  });
});
