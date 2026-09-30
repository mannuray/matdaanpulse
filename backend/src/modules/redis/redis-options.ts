import type { RedisOptions } from 'ioredis';

type Env = Record<string, string | undefined>;

export interface RedisConnection {
  /** Set when REDIS_URL is used; passed as the first ioredis argument. */
  url?: string;
  /** Command / publish connection: fails fast so a Redis outage never stalls requests. */
  pub: RedisOptions;
  /** Subscriber connection (SUBSCRIBE mode; no command timeout, autoResubscribe on). */
  sub: RedisOptions;
  /** Credential-free target for logs. */
  description: string;
}

const BASE: RedisOptions = {
  lazyConnect: true,
  keepAlive: 10_000,
  connectTimeout: 5_000,
  maxRetriesPerRequest: 1,
};

/**
 * REDIS_URL (redis:// or rediss:// — TLS, e.g. Upstash) wins; otherwise
 * REDIS_HOST / REDIS_PORT / REDIS_PASSWORD (local docker default).
 */
export function buildRedisConnection(env: Env): RedisConnection {
  const url = env.REDIS_URL?.trim();
  let target: RedisOptions = {};
  let description: string;

  if (url) {
    let parsed: URL;
    try {
      parsed = new URL(url);
    } catch {
      throw new Error('REDIS_URL is not a valid URL');
    }
    if (parsed.protocol !== 'redis:' && parsed.protocol !== 'rediss:') {
      throw new Error('REDIS_URL must start with redis:// or rediss://');
    }
    // ioredis also enables TLS for rediss:// on its own; set it explicitly.
    if (parsed.protocol === 'rediss:') target = { tls: {} };
    description = `${parsed.protocol}//${parsed.hostname}:${parsed.port || 6379}`;
  } else {
    const host = env.REDIS_HOST?.trim() || 'localhost';
    const port = Number(env.REDIS_PORT) || 6379;
    const password = env.REDIS_PASSWORD || undefined;
    target = { host, port, ...(password && { password }) };
    description = `redis://${host}:${port}`;
  }

  return {
    url: url || undefined,
    pub: { ...BASE, ...target, enableOfflineQueue: false, commandTimeout: 1_000 },
    sub: { ...BASE, ...target, autoResubscribe: true },
    description,
  };
}
