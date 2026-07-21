/**
 * Import: judicial retention election results CSV -> judicial_retention_results.
 * Source rows are transcribed by hand from Colorado Secretary of State
 * election results into data/retention_results.csv (see
 * data/retention_results_template.csv for the format).
 *
 * Same judge matching rules as import_ojpe_evaluations.js: judges not
 * already present are created, matched to their court by exact name.
 *
 * Run: npm run import:retention -- [path/to/file.csv]
 * Requires: DATABASE_URL env var.
 */

import pg from 'pg';
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

const FILE = process.argv[2] || 'data/retention_results.csv';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function upsertJudge(client, fullName, courtName) {
  const { rows: courts } = await client.query(`SELECT id FROM co_courts WHERE name = $1`, [courtName]);
  if (!courts.length) throw new Error(`unknown court "${courtName}", must match co_courts.name exactly`);
  const courtId = courts[0].id;
  const { rows } = await client.query(
    `INSERT INTO co_judges (full_name, court_id, active)
     VALUES ($1, $2, TRUE)
     ON CONFLICT (full_name, court_id) DO UPDATE SET synced_at = now()
     RETURNING id`,
    [fullName, courtId]
  );
  return rows[0].id;
}

function parseBool(v) {
  const s = String(v || '').trim().toLowerCase();
  if (['yes', 'true', 'retained', '1', 'y'].includes(s)) return true;
  if (['no', 'false', 'not retained', '0', 'n'].includes(s)) return false;
  return null;
}

async function run() {
  const raw = fs.readFileSync(FILE, 'utf8');
  const rows = parse(raw, { columns: true, skip_empty_lines: true, trim: true });
  const client = await pool.connect();
  let imported = 0;
  try {
    for (const row of rows) {
      if (/^SAMPLE/i.test(row.judge_full_name || '')) continue;
      const judgeId = await upsertJudge(client, row.judge_full_name, row.court_name);
      await client.query(
        `INSERT INTO judicial_retention_results (judge_id, election_year, yes_votes, no_votes, retained)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (judge_id, election_year) DO UPDATE SET
           yes_votes = EXCLUDED.yes_votes, no_votes = EXCLUDED.no_votes,
           retained = EXCLUDED.retained`,
        [judgeId, parseInt(row.election_year, 10),
         row.yes_votes ? parseInt(row.yes_votes, 10) : null,
         row.no_votes ? parseInt(row.no_votes, 10) : null,
         parseBool(row.retained)]
      );
      imported++;
    }
    console.log(`Done. ${imported} retention results imported from ${FILE}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
