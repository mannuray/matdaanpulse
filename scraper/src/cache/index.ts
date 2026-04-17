import Redis from 'ioredis';

/**
 * Redis client configured via environment variables.
 *
 * Expected env vars:
 *   REDIS_HOST, REDIS_PORT, REDIS_PASSWORD
 */
export const redis = new Redis({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD || undefined,
});

redis.on('connect', () => {
  console.log('Connected to Redis');
});

redis.on('error', (err) => {
  console.error('Redis connection error:', err);
});
