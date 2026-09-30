export interface PageMeta {
  page: number;
  limit: number;
  total: number;
}

/** Explicit marker for list results; only instances produce a `pagination` block. */
export class Paginated<T> {
  constructor(
    public readonly data: T[],
    public readonly meta: PageMeta,
  ) {}
}

export function paginated<T>(data: T[], meta: PageMeta): Paginated<T> {
  return new Paginated(data, meta);
}
