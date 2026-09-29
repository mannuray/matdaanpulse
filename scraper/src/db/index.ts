import { Pool } from 'pg';
import { getDbConfig } from './config';

/**
 * Postgres connection pool configured via environment variables.
 *
 * Expected env vars (same names as the repo-root .env.example):
 *   DATABASE_URL, or DB_HOST, DB_PORT, DB_USER, DB_PASS, DB_NAME
 */
export const pool = new Pool(getDbConfig());

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
