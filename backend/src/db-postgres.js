/**
 * Stage 10 — PostgreSQL Production Adapter (`DATABASE_URL`)
 * Works alongside `database/postgres_schema.sql` and `docs/architecture/POSTGRES_MIGRATION.md`.
 * Keeps SQLite (`db.js`) as the zero-configuration local/demo runtime while providing
 * parameterized `$1, $2` query translation and connection pooling hooks for managed PostgreSQL.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../');

/**
 * Converts SQLite `?` positional placeholders to PostgreSQL `$1, $2, ...` placeholders.
 */
export function sqliteToPostgresPlaceholders(sql) {
  let index = 0;
  return String(sql).replace(/\?/g, () => `$${++index}`);
}

export function getPostgresSchemaSql() {
  return fs.readFileSync(path.join(root, 'database/postgres_schema.sql'), 'utf8');
}

export async function createPostgresPool(connectionString = process.env.DATABASE_URL) {
  if (!connectionString) {
    throw new Error('DATABASE_URL is required to initialize the PostgreSQL pool.');
  }
  const pg = await import('pg');
  const Pool = pg.default?.Pool || pg.Pool;
  const pool = new Pool({
    connectionString,
    max: Number(process.env.PG_POOL_MAX || 10),
    idleTimeoutMillis: 30_000,
    ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: true } : false
  });
  return {
    pool,
    async query(sql, params = []) {
      const pgSql = sqliteToPostgresPlaceholders(sql);
      return pool.query(pgSql, params);
    },
    async close() {
      await pool.end();
    }
  };
}
