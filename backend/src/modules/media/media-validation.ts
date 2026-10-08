import { BadRequestException, PayloadTooLargeException } from '@nestjs/common';

export const MEDIA_KINDS = ['party-logo', 'party-eci', 'person-photo'] as const;
export type MediaKind = (typeof MEDIA_KINDS)[number];

const MB = 1024 * 1024;
export const MAX_BYTES: Record<MediaKind, number> = { 'party-logo': MB, 'party-eci': MB, 'person-photo': 2 * MB };
/** Multer's hard cap: the largest per-kind limit (the per-kind check runs after). */
export const MAX_UPLOAD_BYTES = Math.max(...Object.values(MAX_BYTES));

/** Any non-empty id up to 64 chars (party ids may be e.g. `JD(U)`); only `blobPath` sanitises it, for the path. */
export const MAX_OWNER_ID = 64;

export interface ImageType { ext: 'png' | 'jpg' | 'webp' | 'svg'; contentType: string }

// XML prolog, comments and a doctype (optionally with an internal subset) may come before
// the <svg> root (seed files have them). Every piece is unambiguous, so the match stays linear
// on hostile input: a lazy `[\s\S]*?` comment inside the outer `*` backtracked exponentially.
const SVG_ROOT = /^(?:<\?xml[^>]*>\s*|<!--(?:[^-]|-(?!->))*-->\s*|<!DOCTYPE[^>\[]*(?:\[[^\]]*\][^>]*)?>\s*)*<svg[\s>/]/i;

/** The image type from the file's bytes, or null when it is not PNG, JPEG, WebP or SVG. */
export function sniffImage(buf: Buffer): ImageType | null {
  if (buf.length >= 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { ext: 'png', contentType: 'image/png' };
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return { ext: 'jpg', contentType: 'image/jpeg' };
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return { ext: 'webp', contentType: 'image/webp' };
  }
  const head = buf.subarray(0, 4096).toString('utf8').replace(/^﻿/, '').trimStart();
  if (SVG_ROOT.test(head)) return { ext: 'svg', contentType: 'image/svg+xml' };
  return null;
}

/** Elements that run script, embed other documents or define handlers: refused anywhere in an uploaded SVG. */
const BLOCKED_ELEMENTS = new Set(['script', 'foreignobject', 'iframe', 'embed', 'object', 'handler', 'listener', 'frame', 'frameset', 'applet', 'meta', 'link', 'base']);
const NAMED_ENTITIES: Record<string, string> = { colon: ':', tab: '\t', newline: '\n', sol: '/', lpar: '(', rpar: ')', amp: '&' };

function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-f]+|#\d+|[a-z]+);?/gi, (m, e: string) => {
    if (e[0] !== '#') return NAMED_ENTITIES[e.toLowerCase()] ?? m;
    const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10);
    return Number.isFinite(code) && code >= 0 && code <= 0x10ffff ? String.fromCodePoint(code) : '';
  });
}

/** An href that stays inside the file: a fragment (#id) or an embedded raster image. */
const SAFE_HREF = /^(#|data:image\/(?:png|jpe?g|gif|webp);base64,)/i;

/**
 * Why an SVG is unsafe to host, or null. SVGs are refused (not rewritten) when they carry active content or
 * external references: script-capable elements, on* handlers, javascript:/vbscript: URLs (also entity-encoded or
 * split by whitespace), entity declarations, external hrefs, CSS @import / external url(), xml-stylesheet, or an
 * animated href. Scans the whole file with linear-time patterns (tags are tokenised, never backtracked across).
 */
export function svgActiveContent(buf: Buffer): string | null {
  const raw = buf.toString('utf8');
  // Illustrator exports declare namespace URLs as entities (seed BSP.svg); anything else (external SYSTEM/PUBLIC
  // entities, parameter entities, nested references, billion-laughs chains) is refused. Counted first so the
  // declaration pattern runs at most 20 times.
  const declared = (raw.match(/<!ENTITY/gi) ?? []).length;
  if (declared > 20) return 'an entity declaration';
  if (declared) {
    const entities = [...raw.matchAll(/<!ENTITY\s+([^\s>]+)\s+("[^"]*"|'[^']*'|[^>]*)>/gi)];
    if (entities.length !== declared || entities.some(([, , value]) => !/^["']https?:\/\/[^\s"'<>&%]*["']$/.test(value.trim()))) {
      return 'an entity declaration';
    }
  }
  if (/<\?xml-stylesheet/i.test(raw)) return 'an external stylesheet';
  if (/@import/i.test(raw)) return 'a CSS @import';
  if (/url\(\s*(?!\s|['"]?\s*#)/i.test(decodeEntities(raw))) return 'an external url() reference';
  const compact = decodeEntities(raw).replace(/[\s\u0000-\u001f]+/g, '').toLowerCase();
  if (/(?:java|vb|live)script:/.test(compact)) return 'a script URL';
  for (const tag of raw.match(/<[^<>]*>?/g) ?? []) {
    const name = /^<\s*\/?\s*([a-z0-9_.:-]+)/i.exec(tag)?.[1];
    if (!name) continue; // comment, doctype, processing instruction
    const local = name.toLowerCase().split(':').pop()!;
    if (BLOCKED_ELEMENTS.has(local)) return `a <${local}> element`;
    const attrs = decodeEntities(tag.slice(1 + name.length));
    if (/[\s"'/]on[a-z]+\s*=/i.test(attrs)) return 'an event handler attribute';
    if (/attributename\s*=\s*["']\s*(?:xlink:)?href/i.test(attrs)) return 'an animated link';
    for (const m of attrs.matchAll(/(?:^|[\s"'/])(?:xlink:)?href\s*=\s*(?:"([^"]*)"|'([^']*)')/gi)) {
      if (!SAFE_HREF.test((m[1] ?? m[2] ?? '').trim())) return 'an external link';
    }
  }
  return null;
}

const NAMES: Record<MediaKind, string> = { 'party-logo': 'logo', 'party-eci': 'eci', 'person-photo': 'photo' };
export function blobPath(kind: MediaKind, ownerId: string, ext: string): string {
  // Party ids may hold any character; keep only path-safe ones so `../x` can't traverse.
  const owner = ownerId.replace(/[^A-Za-z0-9_-]/g, '_');
  return `${kind === 'person-photo' ? 'persons' : 'parties'}/${owner}/${NAMES[kind]}.${ext}`;
}

/** Checks an uploaded file for its kind; throws 400/413 with a message the admin shows as-is. */
export function validateUpload(
  file: { buffer: Buffer; size: number } | undefined,
  kind: MediaKind,
  ownerId: string,
): ImageType & { path: string } {
  if (!MEDIA_KINDS.includes(kind)) throw new BadRequestException(`Unknown image kind "${kind}"`);
  if (typeof ownerId !== 'string' || !ownerId || ownerId.length > MAX_OWNER_ID) throw new BadRequestException('Invalid owner id');
  if (!file || !file.buffer?.length) throw new BadRequestException('Choose an image file');
  if (file.size > MAX_BYTES[kind]) {
    throw new PayloadTooLargeException(`Image is too large (max ${MAX_BYTES[kind] / MB} MB)`);
  }
  const type = sniffImage(file.buffer);
  if (!type) throw new BadRequestException('Use a PNG, JPEG, WebP or SVG image');
  if (type.ext === 'svg') {
    const why = svgActiveContent(file.buffer);
    if (why) throw new BadRequestException(`This SVG has active content (${why}); export it as a plain SVG or a PNG`);
  }
  return { ...type, path: blobPath(kind, ownerId, type.ext) };
}
