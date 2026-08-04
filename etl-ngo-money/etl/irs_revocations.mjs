// =============================================================================
// ETL: IRS Auto-Revocation List -> ngo_orgs.exemption_revoked
//
// Source: https://apps.irs.gov/pub/epostcard/data-download-revocation.zip
//         (pipe-delimited, no header: EIN|Legal Name|DBA|Address|City|State|
//          ZIP|Country|Exemption Type|Revocation Date|Posting Date|
//          Reinstatement Date)
// Run:    node etl/irs_revocations.mjs
//
// Marks ngo_orgs rows whose EIN appears on the list with exemption_revoked
// and the revocation date. An org with a reinstatement date on file is
// treated as NOT revoked, and any org previously flagged that no longer
// matches a live revocation is cleared, so the flag always reflects the
// current list rather than accumulating forever.
//
// Requires: DATABASE_URL env var.
// =============================================================================
import AdmZip from 'adm-zip';
import { makePool, cleanEin, politeFetch } from './lib.mjs';

const ZIP_URL = 'https://apps.irs.gov/pub/epostcard/data-download-revocation.zip';

// The IRS writes dates as DD-MON-YYYY; older extracts used MM/DD/YYYY.
const MONTHS = { jan: '01', feb: '02', mar: '03', apr: '04', may: '05', jun: '06',
                 jul: '07', aug: '08', sep: '09', oct: '10', nov: '11', dec: '12' };
function parseIrsDate(raw) {
  const s = String(raw || '').trim();
  if (!s) return null;
  let m = s.match(/^(\d{1,2})-([A-Za-z]{3})[A-Za-z]*-?(\d{4})$/);
  if (m) {
    const mo = MONTHS[m[2].toLowerCase()];
    return mo ? `${m[3]}-${mo}-${m[1].padStart(2, '0')}` : null;
  }
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, '0')}-${m[2].padStart(2, '0')}`;
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? s : null;
}

async function run() {
  const pool = makePool();
  const client = await pool.connect();
  try {
    // Only EINs we actually track need to be checked against the list.
    const { rows: orgs } = await client.query('SELECT id, ein FROM ngo_orgs');
    const einToId = new Map();
    for (const o of orgs) {
      const ein = cleanEin(o.ein);
      if (ein) einToId.set(ein, o.id);
    }
    console.log(`${einToId.size} tracked EINs; downloading revocation list...`);

    const res = await politeFetch(ZIP_URL);
    if (!res.ok) throw new Error(`revocation list download failed: HTTP ${res.status}`);
    const zip = new AdmZip(Buffer.from(await res.arrayBuffer()));
    const entry = zip.getEntries().find((e) => !e.isDirectory);
    if (!entry) throw new Error('revocation zip contained no file');

    // ein -> { date, reinstated } for tracked orgs only, so a multi-million
    // line file never becomes a multi-million row write.
    const revoked = new Map();
    let lines = 0;
    for (const line of entry.getData().toString('utf8').split('\n')) {
      lines++;
      const parts = line.split('|');
      if (parts.length < 10) continue;
      const ein = cleanEin(parts[0]);
      if (!ein || !einToId.has(ein)) continue;
      revoked.set(ein, {
        date: parseIrsDate(parts[9]),
        reinstated: String(parts[11] || '').trim() !== '',
      });
    }
    console.log(`scanned ${lines} list lines, ${revoked.size} tracked EINs appear on the list`);

    let flagged = 0;
    let cleared = 0;
    for (const [ein, id] of einToId) {
      const hit = revoked.get(ein);
      if (hit && !hit.reinstated) {
        const r = await client.query(
          `UPDATE ngo_orgs
           SET exemption_revoked = TRUE, revocation_date = $2, updated_at = now()
           WHERE id = $1 AND (exemption_revoked IS DISTINCT FROM TRUE
                              OR revocation_date IS DISTINCT FROM $2)`,
          [id, hit.date]
        );
        flagged += r.rowCount;
      } else {
        const r = await client.query(
          `UPDATE ngo_orgs
           SET exemption_revoked = FALSE, revocation_date = NULL, updated_at = now()
           WHERE id = $1 AND exemption_revoked = TRUE`,
          [id]
        );
        cleared += r.rowCount;
      }
    }
    console.log(`Done. Flagged ${flagged} revoked orgs, cleared ${cleared} previously flagged.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('IRS revocation ETL failed:', err);
  process.exit(1);
});
