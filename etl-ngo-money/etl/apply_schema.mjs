// Applies the full schema chain this pipeline depends on, in dependency
// order. The ngo_money_loop view joins organizations/funding_events, which
// live in migrations/schema_v2.sql - if that was never applied to the target
// database, applying the NGO schema alone fails, and because a multi-statement
// simple query runs in one implicit transaction, the failure used to roll
// back the NGO base tables too (this is exactly why production returned
// "schema_not_migrated" for months). Every file is idempotent, so a fresh
// database, a partial one, and an up-to-date one all end in the same place.
// Requires: DATABASE_URL.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { makePool } from './lib.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const files = [
  // Base tables the money-loop view depends on (repo root /migrations)
  join(here, '..', '..', 'migrations', 'schema_v2.sql'),
  join(here, '..', '..', 'migrations', 'schema_v2_addendum.sql'),
  // The NGO money loop's own tables + view
  join(here, '..', 'sql', 'ngo_money_schema.sql'),
];

const pool = makePool();
const client = await pool.connect();
try {
  for (const f of files) {
    let text;
    try {
      text = readFileSync(f, 'utf8');
    } catch {
      // Standalone checkouts of etl-ngo-money/ won't have the repo-root
      // migrations; skip them with a loud note rather than dying.
      console.warn(`skipping (not found): ${f}`);
      continue;
    }
    await client.query(text);
    console.log(`applied: ${f}`);
  }
  console.log('Schema chain applied.');
} catch (err) {
  console.error('Schema apply failed:', err.message);
  process.exitCode = 1;
} finally {
  client.release();
  await pool.end();
}
