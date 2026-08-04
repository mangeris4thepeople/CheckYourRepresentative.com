// =============================================================================
// ETL: ProPublica Nonprofit Explorer enrichment -> ngo_orgs + ngo_name_crosswalk
//
// For TRACER contributors that have no crosswalk row yet, searches ProPublica
// Nonprofit Explorer (IRS Form 990 data) for the organization, stores the IRS
// identity (EIN, legal name, 501(c) subsection, latest total revenue) in
// ngo_orgs, and writes a crosswalk row with status 'candidate'. Nothing is
// auto-confirmed: every candidate waits for a human on /admin/crosswalk.
//
// Source: https://projects.propublica.org/nonprofits/api/v2/ (public, no key)
// Run:    node etl/propublica_enrich.mjs --limit 200
//
// Requires: DATABASE_URL env var.
// =============================================================================
import { parseArgs } from 'node:util';
import { makePool, normalizeName, cleanEin, politeFetch, sleep } from './lib.mjs';

const { values } = parseArgs({ options: { limit: { type: 'string', default: '100' } } });
const LIMIT = Math.max(1, parseInt(values.limit, 10) || 100);

const API = 'https://projects.propublica.org/nonprofits/api/v2';

function subsectionLabel(subseccd) {
  const n = parseInt(subseccd, 10);
  return Number.isFinite(n) && n > 0 ? `501(c)(${n})` : null;
}

async function searchOrg(name) {
  const res = await politeFetch(`${API}/search.json?q=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const data = await res.json();
  return (data.organizations || [])[0] || null;
}

async function fetchOrgDetail(ein) {
  const res = await politeFetch(`${API}/organizations/${ein}.json`);
  if (res.status === 404) return null;
  if (!res.ok) return null;
  return res.json();
}

async function run() {
  const pool = makePool();
  const client = await pool.connect();
  try {
    // Unmatched contributors, biggest total dollars first, so review effort
    // goes where the money is.
    const { rows: pending } = await client.query(
      `SELECT c.contributor_normalized,
              MIN(c.contributor_name) AS contributor_name,
              SUM(c.amount) AS total_amount
       FROM tracer_contributions c
       WHERE NOT EXISTS (
         SELECT 1 FROM ngo_name_crosswalk x
         WHERE x.contributor_normalized = c.contributor_normalized
       )
       GROUP BY c.contributor_normalized
       ORDER BY SUM(c.amount) DESC NULLS LAST
       LIMIT $1`,
      [LIMIT]
    );
    console.log(`${pending.length} unmatched contributors to enrich (limit ${LIMIT})`);

    let candidates = 0;
    for (const p of pending) {
      let hit;
      try {
        hit = await searchOrg(p.contributor_name);
      } catch (e) {
        console.warn(`search failed for "${p.contributor_name}": ${e.message}`);
        continue;
      }
      if (!hit || !hit.ein) {
        console.log(`no IRS match: ${p.contributor_name}`);
        await sleep(300);
        continue;
      }

      const ein = cleanEin(hit.ein);
      if (!ein) { await sleep(300); continue; }

      const detail = await fetchOrgDetail(ein).catch(() => null);
      const org = detail?.organization || {};
      const legalName = org.name || hit.name || p.contributor_name;
      // Latest filing with data carries the revenue figure shown in the loop.
      const filings = (detail?.filings_with_data || [])
        .filter((f) => f.tax_prd_yr)
        .sort((a, b) => b.tax_prd_yr - a.tax_prd_yr);
      const latest = filings[0] || null;

      const { rows: orgRows } = await client.query(
        `INSERT INTO ngo_orgs
           (ein, legal_name, name_normalized, subsection, ntee_code, city, state,
            total_revenue, revenue_fiscal_year, propublica_url)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
         ON CONFLICT (ein) DO UPDATE SET
           legal_name = EXCLUDED.legal_name,
           name_normalized = EXCLUDED.name_normalized,
           subsection = COALESCE(EXCLUDED.subsection, ngo_orgs.subsection),
           ntee_code = COALESCE(EXCLUDED.ntee_code, ngo_orgs.ntee_code),
           city = COALESCE(EXCLUDED.city, ngo_orgs.city),
           state = COALESCE(EXCLUDED.state, ngo_orgs.state),
           total_revenue = COALESCE(EXCLUDED.total_revenue, ngo_orgs.total_revenue),
           revenue_fiscal_year = COALESCE(EXCLUDED.revenue_fiscal_year, ngo_orgs.revenue_fiscal_year),
           propublica_url = EXCLUDED.propublica_url,
           updated_at = now()
         RETURNING id`,
        [
          ein,
          legalName,
          normalizeName(legalName),
          subsectionLabel(org.subsection_code ?? hit.subseccd),
          org.ntee_code || hit.ntee_code || null,
          org.city || hit.city || null,
          (org.state || hit.state || '').slice(0, 2) || null,
          latest?.totrevenue ?? null,
          latest?.tax_prd_yr ?? null,
          `https://projects.propublica.org/nonprofits/organizations/${ein}`,
        ]
      );

      const exact = normalizeName(legalName) === p.contributor_normalized;
      await client.query(
        `INSERT INTO ngo_name_crosswalk
           (contributor_normalized, org_id, match_method, confidence, status)
         VALUES ($1, $2, $3, $4, 'candidate')
         ON CONFLICT (contributor_normalized, org_id) DO NOTHING`,
        [p.contributor_normalized, orgRows[0].id, exact ? 'exact_name' : 'search_best_hit', exact ? 0.95 : 0.5]
      );
      candidates++;
      console.log(`candidate: "${p.contributor_name}" -> ${legalName} (EIN ${ein}${exact ? ', exact' : ''})`);

      // Be polite to the public ProPublica endpoint.
      await sleep(300);
    }
    console.log(`Done. Wrote ${candidates} crosswalk candidates for human review.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('ProPublica enrichment failed:', err);
  process.exit(1);
});
