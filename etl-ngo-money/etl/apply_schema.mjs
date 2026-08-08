// Applies sql/ngo_money_schema.sql to the database. Every statement in that
// file is idempotent, so this runs at the top of every pipeline run and a
// fresh database, a partial one, and an up-to-date one all end in the same
// place. Requires: DATABASE_URL.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePool } from './lib.mjs';

const sqlPath = join(dirname(fileURLToPath(import.meta.url)), '..', 'sql', 'ngo_money_schema.sql');

const pool = makePool();
const client = await pool.connect();
try {
  await client.query(readFileSync(sqlPath, 'utf8'));
  console.log('ngo_money_schema.sql applied.');
} catch (err) {
  console.error('Schema apply failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
