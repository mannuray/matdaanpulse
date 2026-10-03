export const q = (v: string | number | null): string => (v === null ? 'NULL' : typeof v === 'number' ? String(v) : `'${v.replace(/'/g, "''")}'`);
