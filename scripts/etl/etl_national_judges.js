/**
 * ETL: CourtListener -> nat_courts + nat_judges (the National Judge Directory).
 * Local mirror of api/_handlers/sync-judges-national.js for running against a
 * dev database. Production uses the cron endpoint instead, which batches under
 * the serverless time cap; this local run has no cap and does every court in
 * one pass, so expect it to take a while on the first backfill.
 * Run: npm run etl:judges-national
 *   (apply sql/national_judge_schema.sql first)
 * Requires: DATABASE_URL, COURTLISTENER_API_TOKEN env vars.
 */

import pg from 'pg';

const CL_TOKEN = process.env.COURTLISTENER_API_TOKEN;
const CL_BASE = 'https://www.courtlistener.com/api/rest/v4';
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const JURISDICTIONS = new Set(['F', 'FD', 'FS', 'S', 'SA', 'TS', 'TA']);

// Longest, most specific first; case sensitive so "Kansas" never matches
// inside "Arkansas". Mirrors sync-judges-national.js exactly.
const STATE_PATTERNS = [
  ['District of Columbia', 'DC'], ['West Virginia', 'WV'], ['North Carolina', 'NC'],
  ['South Carolina', 'SC'], ['North Dakota', 'ND'], ['South Dakota', 'SD'],
  ['New Hampshire', 'NH'], ['New Jersey', 'NJ'], ['New Mexico', 'NM'],
  ['New York', 'NY'], ['Rhode Island', 'RI'], ['Puerto Rico', 'PR'],
  ['Virgin Islands', 'VI'], ['American Samoa', 'AS'], ['Northern Mariana', 'MP'],
  ['Guam', 'GU'],
  ['Alabama', 'AL'], ['Alaska', 'AK'], ['Arizona', 'AZ'], ['Arkansas', 'AR'],
  ['California', 'CA'], ['Colorado', 'CO'], ['Connecticut', 'CT'], ['Delaware', 'DE'],
  ['Florida', 'FL'], ['Georgia', 'GA'], ['Hawai', 'HI'], ['Idaho', 'ID'],
  ['Illinois', 'IL'], ['Indiana', 'IN'], ['Iowa', 'IA'], ['Kansas', 'KS'],
  ['Kentucky', 'KY'], ['Louisiana', 'LA'], ['Maine', 'ME'], ['Maryland', 'MD'],
  ['Massachusetts', 'MA'], ['Michigan', 'MI'], ['Minnesota', 'MN'], ['Mississippi', 'MS'],
  ['Missouri', 'MO'], ['Montana', 'MT'], ['Nebraska', 'NE'], ['Nevada', 'NV'],
  ['Ohio', 'OH'], ['Oklahoma', 'OK'], ['Oregon', 'OR'], ['Pennsylvania', 'PA'],
  ['Tennessee', 'TN'], ['Texas', 'TX'], ['Utah', 'UT'], ['Vermont', 'VT'],
  ['Virginia', 'VA'], ['Washington', 'WA'], ['Wisconsin', 'WI'], ['Wyoming', 'WY'],
];

function stateOf(name) {
  for (const [pattern, code] of STATE_PATTERNS) {
    if (name.includes(pattern)) return code;
  }
  return null;
}

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

async function resolvePerson(person, cache) {
  if (!person) return null;
  if (typeof person === 'object' && person.id) return person;
  if (typeof person === 'string') {
    if (cache.has(person)) return cache.get(person);
    const data = await cl(person.startsWith('http') ? person : `${CL_BASE}${person}`);
    const resolved = data && data.id ? data : null;
    cache.set(person, resolved);
    return resolved;
  }
  return null;
}

function personIdOf(person) {
  if (!person) return null;
  if (typeof person === 'object' && person.id) return person.id;
  if (typeof person === 'string') {
    const m = person.match(/\/people\/(\d+)\//);
    if (m) return parseInt(m[1], 10);
  }
  return null;
}

async function run() {
  if (!CL_TOKEN) throw new Error('COURTLISTENER_API_TOKEN not set');
  const client = await pool.connect();
  try {
    // Court list: page through everything, filter client side (the courts
    // endpoint's filter whitelist is unverified, and CourtListener hard-fails
    // unknown filter params).
    let url = `${CL_BASE}/courts/?page_size=50`;
    let courtCount = 0;
    while (url) {
      const data = await cl(url);
      for (const c of data.results || []) {
        if (!c.in_use || !JURISDICTIONS.has(c.jurisdiction)) continue;
        const name = c.full_name || c.short_name || c.id;
        await client.query(
          `INSERT INTO nat_courts (courtlistener_id, name, jurisdiction, state)
           VALUES ($1, $2, $3, $4)
           ON CONFLICT (courtlistener_id) DO UPDATE SET
             name = EXCLUDED.name, jurisdiction = EXCLUDED.jurisdiction, state = EXCLUDED.state`,
          [c.id, name, c.jurisdiction, stateOf(name)]
        );
        courtCount++;
      }
      url = data.next || null;
    }
    console.log(`${courtCount} courts on file.`);

    const { rows: courts } = await client.query(
      `SELECT id, name, courtlistener_id FROM nat_courts ORDER BY id`
    );
    let total = 0;
    for (const court of courts) {
      const personCache = new Map();
      let posUrl = `${CL_BASE}/positions/?court=${encodeURIComponent(court.courtlistener_id)}` +
        `&page_size=50&order_by=-id`;
      let synced = 0;
      for (let page = 0; page < 4 && posUrl; page++) {
        const data = await cl(posUrl);
        for (const pos of data.results || []) {
          if (pos.date_termination) {
            const pid = personIdOf(pos.person);
            if (pid) {
              await client.query(
                `UPDATE nat_judges SET active = FALSE, date_termination = $1, synced_at = now()
                 WHERE courtlistener_person_id = $2 AND court_id = $3 AND active`,
                [pos.date_termination, pid, court.id]
              );
            }
            continue;
          }
          const person = await resolvePerson(pos.person, personCache);
          if (!person) continue;
          const name = personName(person);
          if (!name) continue;
          await client.query(
            `INSERT INTO nat_judges
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
        posUrl = data.next || null;
      }
      await client.query(`UPDATE nat_courts SET judges_synced_at = now() WHERE id = $1`, [court.id]);
      total += synced;
      console.log(`${court.name}: ${synced} judges`);
    }
    console.log(`Done. ${total} judges synced across ${courts.length} courts.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('ETL failed:', err);
  process.exit(1);
});
