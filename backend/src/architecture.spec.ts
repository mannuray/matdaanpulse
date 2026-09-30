import { readdirSync, readFileSync, statSync } from 'fs';
import { join, relative, sep } from 'path';

function tsFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const p = join(dir, name);
    return statSync(p).isDirectory() ? tsFiles(p) : p.endsWith('.ts') ? [p] : [];
  });
}

/** Dependency direction (review D-L1): domain modules never import from modules/admin. */
describe('module dependency direction', () => {
  it('nothing outside src/modules/admin imports from modules/admin (except the root AppModule)', () => {
    const root = __dirname;
    const adminDir = join(root, 'modules', 'admin');
    const offenders: string[] = [];
    for (const file of tsFiles(root)) {
      if (file.startsWith(adminDir + sep) || relative(root, file) === 'app.module.ts' || file === __filename) continue;
      const src = readFileSync(file, 'utf8');
      for (const m of src.matchAll(/(?:from|import\()\s*['"]([^'"]+)['"]/g)) {
        const spec = m[1];
        if (!spec.startsWith('.')) continue;
        const target = join(file, '..', spec);
        if (target === adminDir || target.startsWith(adminDir + sep)) offenders.push(`${relative(root, file)} -> ${spec}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
