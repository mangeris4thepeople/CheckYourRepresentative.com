/**
 * Import: OJPE judicial performance evaluations CSV -> ojpe_evaluations.
 * Source rows are transcribed by hand from Colorado Office of Judicial
 * Performance Evaluation publications into data/ojpe_evaluations.csv
 * (see data/ojpe_evaluations_template.csv for the format).
 *
 * Judges named in the CSV that are not already in co_judges (trial court
 * judges, which the CourtListener sync does not cover) are created here,
 * matched to their court by exact court name.
 *
 * Run: npm run import:ojpe -- [path/to/file.csv]
 * Requires: DATABASE_URL env var.
 */

import pg from 'pg';
import fs from 'node:fs';
import { parse } from 'csv-parse/sync';

const FILE = process.argv[2] || 'data/ojpe_evaluations.csv';
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
        `INSERT INTO ojpe_evaluations (judge_id, eval_year, recommendation, retention_score, narrative_url)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (judge_id, eval_year) DO UPDATE SET
           recommendation = EXCLUDED.recommendation,
           retention_score = EXCLUDED.retention_score,
           narrative_url = EXCLUDED.narrative_url`,
        [judgeId, parseInt(row.eval_year, 10), row.recommendation || null,
         row.retention_score ? parseFloat(row.retention_score) : null,
         row.narrative_url || null]
      );
      imported++;
    }
    console.log(`Done. ${imported} evaluations imported from ${FILE}.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Import failed:', err);
  process.exit(1);
});
