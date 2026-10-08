import type { Observable } from 'rxjs';

/**
 * Narrow views of RedisService, one per kind of consumer. RedisService implements all of them; a consumer
 * still injects it with `@Inject(RedisService)` (an interface is not a Nest token) but types the field as
 * the one view it needs.
 */

/** Plain string keys with an optional TTL (CacheService). */
export interface KeyValueStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string, ttlSeconds?: number): Promise<void>;
  del(key: string): Promise<void>;
  delByPattern(pattern: string): Promise<void>;
}

/** Pub/sub channels plus the shutdown signal that ends their streams (LiveService). */
export interface PubSub {
  publish(channel: string, data: unknown): Promise<boolean>;
  subscribe(channel: string): Observable<string>;
  readonly shutdown$: Observable<void>;
}

/** Keys owned by a user, taken and released atomically (SeatLockService). */
export interface OwnedLockStore {
  isPubReady(): boolean;
  getMany(pattern: string): Promise<string[]>;
  acquireOwned(key: string, owner: string, value: string, ttlSeconds: number): Promise<string | null>;
  releaseOwned(key: string, owner: string): Promise<boolean>;
  forceSet(key: string, value: string, ttlSeconds: number): Promise<string | null>;
}

/** Connection health for probes and the status page. */
export interface RedisHealth {
  ping(timeoutMs?: number): Promise<void>;
  isSubscriberReady(): boolean;
  connectionStates(): { pubReady: boolean; subReady: boolean };
}

/** The two shutdown steps (GracefulShutdownService). */
export interface RedisLifecycle {
  completeStreams(): void;
  close(): Promise<void>;
}
