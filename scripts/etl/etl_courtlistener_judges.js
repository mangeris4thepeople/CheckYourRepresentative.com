/**
 * ETL: CourtListener -> co_judges (Colorado appellate judges).
 * Local mirror of api/_handlers/sync-judges.js for running against a dev
 * database. Production uses the cron endpoint instead.
 * Run: npm run etl:judges
 * Requires: DATABASE_URL, COURTLISTENER_API_TOKEN env vars.
 */

import pg from 'pg';

const CL_TOKEN = process.env.COURTLISTENER_API_TOKEN;
const CL_BASE = 'https://www.courtlistener.com/api/rest/v4';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function cl(url) {
  const r = await fetch(url, { headers: { Authorization: `Token ${CL_TOKEN}` } });
  if (!r.ok) throw new Error(`CourtListener ${r.status} on ${url.slice(0, 120)}`);
  return r.json();
}

function personName(p) {
  const parts = [p.name_first, p.name_middle, p.name_last].filter(Boolean).join(' ').trim();
  const suffix = p.name_suffix ? ` ${p.name_suffix}` : '';
  return (parts + suffix).trim() || null;
}

async function resolvePerson(person) {
  if (!person) return null;
  if (typeof person === 'object' && person.id) return person;
  if (typeof person === 'string') {
    const data = await cl(person.startsWith('http') ? person : `${CL_BASE}${person}`);
    return data && data.id ? data : null;
  }
  return null;
}

async function run() {
  if (!CL_TOKEN) throw new Error('COURTLISTENER_API_TOKEN not set');
  const client = await pool.connect();
  try {
    const { rows: courts } = await client.query(
      `SELECT id, name, courtlistener_id FROM co_courts WHERE courtlistener_id IS NOT NULL ORDER BY id`
    );
    let total = 0;
    for (const court of courts) {
      let url = `${CL_BASE}/positions/?court=${encodeURIComponent(court.courtlistener_id)}` +
        `&date_termination__isnull=True&page_size=50&order_by=id`;
      let synced = 0;
      while (url) {
        const data = await cl(url);
        for (const pos of data.results || []) {
          const person = await resolvePerson(pos.person);
          if (!person) continue;
          const name = personName(person);
          if (!name) continue;
          await client.query(
            `INSERT INTO co_judges
               (courtlistener_person_id, full_name, court_id, position_title,
                appointed_by, date_start, date_termination, active, synced_at)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
             ON CONFLICT (courtlistener_person_id) DO UPDATE SET
               full_name = EXCLUDED.full_name, court_id = EXCLUDED.court_id,
               position_title = EXCLUDED.position_title, appointed_by = EXCLUDED.appointed_by,
               date_start = EXCLUDED.date_start, date_termination = EXCLUDED.date_termination,
               active = EXCLUDED.active, synced_at = now()`,
            [person.id, name, court.id, pos.job_title || pos.position_type || null,
             pos.appointer_str || null, pos.date_start || null, pos.date_termination || null,
             !pos.date_termination]
          );
          synced++;
        }
        url = data.next || null;
      }
      total += synced;
      console.log(`${court.name}: ${synced} judges`);
    }
    console.log(`Done. ${total} judges synced.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
