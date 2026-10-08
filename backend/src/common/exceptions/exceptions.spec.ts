import { HttpStatus } from '@nestjs/common';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';
import { CandidateNotFoundException, ManifestNoDraftException } from './index';
import { ErrorCodes } from './error-codes';

describe('exception codes', () => {
  it('a missing candidate is CANDIDATE_7001 (not the generic GEN_0002)', () => {
    const e = new CandidateNotFoundException('c1');
    expect(e.code).toBe('CANDIDATE_7001');
    expect(e.getStatus()).toBe(HttpStatus.NOT_FOUND);
  });

  it('publishing with no draft is a 409 state conflict (the election exists), MANIFEST_8002', () => {
    const e = new ManifestNoDraftException('e1');
    expect(e.code).toBe('MANIFEST_8002');
    expect(e.getStatus()).toBe(HttpStatus.CONFLICT);
  });
});

/** Every backend source file except error-codes.ts and specs. */
function sources(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) return sources(p);
    return p.endsWith('.ts') && !p.endsWith('.spec.ts') && !p.endsWith('error-codes.ts') ? [p] : [];
  });
}

describe('ErrorCodes', () => {
  it('defines only codes the backend throws (no dead codes)', () => {
    const code = sources(join(__dirname, '..', '..')).map((f) => readFileSync(f, 'utf8')).join('\n');
    const unused = Object.keys(ErrorCodes).filter((k) => !new RegExp(`ErrorCodes\\.${k}\\b`).test(code));
    expect(unused).toEqual([]);
  });

  it('has no duplicate code values', () => {
    const values = Object.values(ErrorCodes);
    expect(new Set(values).size).toBe(values.length);
  });
});
