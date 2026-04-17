import { Pool } from 'pg';

/**
 * Postgres connection pool configured via environment variables.
 *
 * Expected env vars:
 *   DATABASE_HOST, DATABASE_PORT, DATABASE_USER, DATABASE_PASSWORD, DATABASE_NAME
 */
export const pool = new Pool({
  host: process.env.DATABASE_HOST || 'localhost',
  port: parseInt(process.env.DATABASE_PORT || '5432', 10),
  user: process.env.DATABASE_USER || 'postgres',
  password: process.env.DATABASE_PASSWORD || '',
  database: process.env.DATABASE_NAME || 'election_tracker',
});

export async function query(text: string, params?: unknown[]) {
  return pool.query(text, params);
}
