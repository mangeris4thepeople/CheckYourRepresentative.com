/**
 * ETL: FARA active foreign principals -> organizations + funding_events
 * Run: npm run etl:fara
 *
 * Requires: DATABASE_URL env var. No API key needed for anything that is
 * actually public here.
 *
 * STATUS (verified live, not assumed): efile.fara.gov is an Oracle APEX/ORDS
 * application (it redirects to /ords/fara/f?p=2000), not a plain JSON API.
 * The endpoint this script originally pointed at does not exist, confirmed by
 * directly requesting it and a dozen other guessed REST paths under
 * /ords/fara/ and /api/, all 404. There is no documented public bulk export
 * URL for active foreign principals as of this writing. Rather than silently
 * "succeed" with zero rows, this script checks the known candidate URLs on
 * every run and fails loudly with FARA_ENDPOINT_NOT_FOUND if none resolve, so
 * a scheduled run surfaces the problem instead of hiding it. Fixing this for
 * real requires either a confirmed current bulk file location from FARA or
 * scripting the APEX application's session-based query interface, which is a
 * larger v2 task, not a one-line URL swap.
 *
 * KNOWN LIMITATION (do not silently paper over), true regardless of which
 * endpoint eventually works: FARA data carries NO dollar amount per foreign
 * principal. The dollar figures live in the individual Exhibit AB PDFs, which
 * would have to be parsed per filing. That is out of scope for v1, so amount
 * is stored as NULL here. compute_transparency only sums non-null amounts, so
 * NULL rows never inflate the traced total.
 */
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

// Candidate URLs, checked in order. None were live as of this writing (see
// STATUS above); kept here as documented dead ends plus the first slot for
// whichever URL FARA actually publishes.
const CANDIDATE_URLS = [
  'https://efile.fara.gov/api/v1/ActiveForeignPrincipals.json',
];

async function upsertOrgByName(client, name) {
  const found = await client.query('SELECT id FROM organizations WHERE lower(name) = lower($1) LIMIT 1', [name]);
  if (found.rows.length) return found.rows[0].id;
  const ins = await client.query('INSERT INTO organizations (name) VALUES ($1) RETURNING id', [name]);
  return ins.rows[0].id;
}

// Build a stable id so re-runs upsert the same relationship instead of duplicating.
function refId(registrant, principal, date) {
  return `fara:${String(registrant || '').toLowerCase()}:${String(principal || '').toLowerCase()}:${date || ''}`.slice(0, 100);
}

async function fetchFirstWorkingSource() {
  for (const url of CANDIDATE_URLS) {
    try {
      const res = await fetch(url);
      if (res.ok) return { url, payload: await res.json() };
      console.warn(`FARA candidate not usable (${res.status}): ${url}`);
    } catch (e) {
      console.warn(`FARA candidate unreachable (${e.message}): ${url}`);
    }
  }
  return null;
}

async function run() {
  const found = await fetchFirstWorkingSource();
  if (!found) {
    // Fail loudly rather than "complete" with zero rows, so a scheduled run
    // shows up as a failed job instead of a silent no-op.
    throw new Error(
      'FARA_ENDPOINT_NOT_FOUND: no working public FARA endpoint. See the STATUS ' +
      'comment at the top of this file. This is expected until a real bulk data ' +
      'URL is confirmed, it is not a connectivity problem to retry.'
    );
  }
  const payload = found.payload;
  // The endpoint returns either a bare array or an object wrapping the array.
  const rows = Array.isArray(payload) ? payload : (payload.ACTIVE_FOREIGN_PRINCIPALS || payload.results || []);

  const client = await pool.connect();
  try {
    let count = 0;
    for (const r of rows) {
      const registrant = r.Registrant_Name || r.registrant_name;
      const principal = r.Foreign_Principal || r.foreign_principal;
      const country = r.Foreign_Principal_Country || r.country || '';
      const regDate = r.Registration_Date || r.registration_date || null;
      if (!registrant || !principal) continue;

      const orgId = await upsertOrgByName(client, registrant);
      await client.query(
        `INSERT INTO funding_events
           (org_id, source_type, source_name, external_ref_id, amount, description,
            period_start, fiscal_year, disclosure_source)
         VALUES ($1, 'foreign_principal', $2, $3, NULL, $4, $5, $6, 'fara')
         ON CONFLICT (external_ref_id) DO NOTHING`,
        [
          orgId,
          country ? `${principal} (${country})` : principal,
          refId(registrant, principal, regDate),
          'Foreign principal relationship disclosed under FARA. No dollar amount in bulk data.',
          regDate,
          regDate ? parseInt(String(regDate).slice(0, 4), 10) : null,
        ]
      );
      count++;
    }
    console.log(`Done. Inserted/updated ${count} FARA foreign-principal relationships.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => { console.error('FARA ETL failed:', err); process.exit(1); });
