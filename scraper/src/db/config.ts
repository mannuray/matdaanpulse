import type { PoolConfig } from 'pg';

/**
 * Postgres connection settings shared by every scraper script.
 *
 * Uses the same variable names as the repo-root `.env.example`:
 *   DATABASE_URL                                  (takes precedence when set)
 *   DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME   (otherwise)
 *
 * No password is hardcoded: when DB_PASS is unset, pg falls back to PGPASSWORD / ~/.pgpass.
 */
export function getDbConfig(): PoolConfig {
  if (process.env.DATABASE_URL) {
    return { connectionString: process.env.DATABASE_URL };
  }
  return {
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '5432', 10),
    user: process.env.DB_USER || 'admin',
    password: process.env.DB_PASS || undefined,
    database: process.env.DB_NAME || 'election_tracker',
  };
}
