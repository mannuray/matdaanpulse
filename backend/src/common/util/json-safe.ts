/**
 * BigInt columns (candidates.assets / liabilities, in rupees) come out of Prisma as `bigint`, which
 * `JSON.stringify` refuses. Rupee amounts fit a JS number exactly (inputs are capped at
 * Number.MAX_SAFE_INTEGER), so every response DTO and audit value turns them into numbers here.
 */
export function bigintToNumber<T>(value: T): T | number {
  return typeof value === 'bigint' ? Number(value) : value;
}

/** class-transformer `@Transform` for a BigInt column. */
export const bigintTransform = ({ value }: { value: unknown }) => bigintToNumber(value);

/** A JSON-safe deep copy (Date → ISO string, bigint → number, undefined → null). */
export function toJsonSafe(value: unknown): unknown {
  return value === undefined ? null : JSON.parse(JSON.stringify(value, (_key, v) => bigintToNumber(v)));
}
