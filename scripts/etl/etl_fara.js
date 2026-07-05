/**
 * ETL: FARA active foreign principals -> organizations + funding_events
 * Source: https://efile.fara.gov/api/v1/ActiveForeignPrincipals.json
 * Run: npm run etl:fara
 *
 * Requires: DATABASE_URL env var. No API key needed (public).
 *
 * We use the stable FARA JSON endpoint rather than the zipped bulk export so a
 * run does not depend on a filename that changes between releases. adm-zip is
 * available in the project if a future version switches to the zipped bulk file.
 *
 * KNOWN LIMITATION (do not silently paper over): FARA bulk and API data carry
 * NO dollar amount per foreign principal. The dollar figures live in the
 * individual Exhibit AB PDFs, which would have to be parsed per filing. That is
 * out of scope for v1, so amount is stored as NULL here. The record still
 * captures the disclosed relationship (which registrant represents which
 * foreign principal), just not a traceable dollar figure. compute_transparency
 * only sums non-null amounts, so these NULL rows never inflate the traced total.
 */
import pg from 'pg';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
const FARA_URL = 'https://efile.fara.gov/api/v1/ActiveForeignPrincipals.json';

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

async function run() {
  const res = await fetch(FARA_URL);
  if (!res.ok) throw new Error(`FARA API error: ${res.status}`);
  const payload = await res.json();
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
