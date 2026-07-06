// =============================================================================
// GET /api/sync-senator-finances - match every senator in the senators table
// to its FEC candidate record, then mirror that candidate's per-cycle
// totals, FEC filings, and a bounded Schedule A donor breakdown into our own
// tables, so the Know Your Rep tab's Senate view can show a full financial
// profile without hitting the FEC API on every page load.
//
// Mirrors api/sync-rep-finances.js exactly: same resumable, rate-limited
// batching (PAGE_SIZE/CONCURRENCY/TIME_BUDGET_MS), same per-chunk time check,
// same upsert-on-conflict safety for repeat calls. The only real difference
// is FEC candidate matching uses office=S and state only, senators have no
// district, and the cursor walks senators by bioguide_id instead of
// district.
//
// FILINGS SOURCE (built correctly from the start, see api/sync-rep-finances.js
// for how this was discovered on the House side): GET /candidate/{id}/filings/
// only ever returns that candidate's own statement-of-candidacy paperwork
// (form_category STATEMENT), with legitimately null financials. Real
// periodic financial reports live under the candidate's principal
// committee's own filing history: GET /committee/{committeeId}/filings/,
// filtered to form_category=REPORT.
//
// MATCHING LIMITATION (do not silently paper over): FEC has no crosswalk
// from a Senate seat straight to a candidate_id, so matching is
// office+state plus a name match, exact last name first, falling back to a
// fuzzy last name match if nothing exact hits. A senator whose FEC filer
// name differs enough to miss both passes is logged and left unmatched
// rather than guessed at. Every unmatched senator is reported back in this
// endpoint's JSON response so a human can review and, if needed, patch
// senators.fec_candidate_id by hand.
// =============================================================================
import { sql, hasDb } from "./_db.js";

const FEC_API_KEY = process.env.FEC_API_KEY;
const FEC_BASE = "https://api.open.fec.gov/v1";
const PAGE_SIZE = 20;              // senators fetched from Postgres per page
const CONCURRENCY = 2;             // parallel senators in flight, mindful of FEC rate limits
const RECENT_CYCLES = 3;           // how many of a candidate's most recent cycles to keep totals for
const FILINGS_LIMIT = 20;          // most recent filings kept per candidate
// vercel.json sets maxDuration: 60 for api/*.js. Time is checked before every
// small CONCURRENCY-sized chunk, not just between whole pages, same as
// api/sync-rep-finances.js (verified live there: a coarser per-page check
// let a slow chunk run past the platform's hard limit).
const TIME_BUDGET_MS = 40000;

// FEC's Schedule A "size" aggregate uses a fixed set of bucket floors.
const SIZE_LABELS = {
  0: "Unitemized (under $200)",
  200: "$200-499",
  500: "$500-999",
  1000: "$1,000-1,999",
  2000: "$2,000+",
};

export default async function handler(req, res) {
  if (!FEC_API_KEY) return res.status(500).json({ error: "FEC_API_KEY not set" });
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  const startedAt = Date.now();
  const outOfTime = () => Date.now() - startedAt > TIME_BUDGET_MS;

  try {
    await ensureTables();

    const cursor = await getCursor();
    let lastId = cursor;
    let processed = 0;
    let stoppedEarly = false;
    const unmatched = [];
    const fuzzyMatched = [];

    let senators = await sql`
      SELECT bioguide_id, name, state, fec_candidate_id FROM senators
      WHERE bioguide_id > ${lastId} ORDER BY bioguide_id ASC LIMIT ${PAGE_SIZE}`;

    pages:
    while (senators.length) {
      for (let i = 0; i < senators.length; i += CONCURRENCY) {
        if (outOfTime()) { stoppedEarly = true; break pages; }
        const batch = senators.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(sen => processSenator(sen, { unmatched, fuzzyMatched })));
        processed += batch.length;
        lastId = batch[batch.length - 1].bioguide_id;
      }
      if (outOfTime()) { stoppedEarly = true; break; }

      senators = await sql`
        SELECT bioguide_id, name, state, fec_candidate_id FROM senators
        WHERE bioguide_id > ${lastId} ORDER BY bioguide_id ASC LIMIT ${PAGE_SIZE}`;
    }

    const reachedEnd = !stoppedEarly;
    await setCursor(reachedEnd ? "" : lastId);

    return res.status(200).json({
      ok: true,
      processed,
      resumeAtBioguideId: reachedEnd ? "" : lastId,
      passComplete: reachedEnd,
      unmatched,
      fuzzyMatched,
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_failed", detail: String(err.message || err) });
  }
}

async function processSenator(sen, log) {
  try {
    let candidateId = sen.fec_candidate_id;

    if (!candidateId) {
      const match = await matchCandidate(sen);
      if (!match) {
        console.warn(`[sync-senator-finances] no FEC match for ${sen.state} ${sen.name}`);
        log.unmatched.push({ bioguideId: sen.bioguide_id, state: sen.state, name: sen.name });
        return;
      }
      candidateId = match.candidateId;
      if (match.fuzzy) {
        console.warn(`[sync-senator-finances] fuzzy match for ${sen.state} ${sen.name} -> ${candidateId} (${match.fecName})`);
        log.fuzzyMatched.push({ bioguideId: sen.bioguide_id, state: sen.state, name: sen.name, candidateId, fecName: match.fecName });
      }
      await sql`UPDATE senators SET fec_candidate_id = ${candidateId} WHERE bioguide_id = ${sen.bioguide_id}`;
    }

    const totals = await fetchTotals(candidateId);
    if (totals.length) await upsertTotals(candidateId, totals);

    // Committee lookup has to happen before filings, see file header.
    const committeeId = await fetchPrincipalCommitteeId(candidateId);

    if (committeeId) {
      const filings = await fetchFilings(committeeId);
      if (filings.length) await upsertFilings(candidateId, filings);
    }

    const latestCycle = totals[0]?.cycle;
    if (committeeId && latestCycle) {
      const buckets = await fetchDonorBuckets(committeeId, latestCycle);
      if (buckets.length) await upsertDonorBuckets(candidateId, committeeId, latestCycle, buckets);
    }
  } catch (err) {
    console.warn(`[sync-senator-finances] failed processing ${sen.state} ${sen.name}: ${err.message || err}`);
  }
}

// ---- FEC candidate matching ----
async function matchCandidate(sen) {
  const state = String(sen.state || "").trim();
  if (!state) return null;

  const data = await fec("/candidates/", { office: "S", state, per_page: 100 });
  const candidates = data.results || [];
  if (!candidates.length) return null;

  const senLast = lastName(sen.name);
  const exact = candidates.filter(c => lastName(fecFirstLast(c.name).last) === senLast);
  const pick = (list) => list.sort((a, b) => (maxCycle(b) - maxCycle(a)) || (a.candidate_inactive ? 1 : -1))[0];

  if (exact.length) return { candidateId: pick(exact).candidate_id, fuzzy: false };

  // Fuzzy fallback: same first four letters of the last name, the same
  // bounded approach api/sync-rep-finances.js uses rather than a full
  // edit-distance match that could silently pick the wrong person.
  const prefix = senLast.slice(0, 4);
  const fuzzy = prefix.length >= 3
    ? candidates.filter(c => lastName(fecFirstLast(c.name).last).slice(0, 4) === prefix)
    : [];
  if (fuzzy.length) {
    const picked = pick(fuzzy);
    return { candidateId: picked.candidate_id, fuzzy: true, fecName: picked.name };
  }

  return null;
}

function lastName(name) {
  return String(name || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z, ]/g, "").split(/[, ]+/).filter(Boolean).pop() || "";
}
// FEC names are "LASTNAME, FIRSTNAME MIDDLE SUFFIX"; ours are "Firstname Lastname".
function fecFirstLast(fecName) {
  const [last, rest] = String(fecName || "").split(",");
  return { last: (last || "").trim(), first: (rest || "").trim() };
}
function maxCycle(c) {
  return Array.isArray(c.cycles) && c.cycles.length ? Math.max(...c.cycles) : 0;
}

// ---- FEC data pulls ----
async function fetchTotals(candidateId) {
  const data = await fec(`/candidate/${candidateId}/totals/`, { sort: "-cycle", per_page: RECENT_CYCLES * 2 });
  return (data.results || [])
    .filter(r => Number.isFinite(r.cycle))
    .sort((a, b) => b.cycle - a.cycle)
    .slice(0, RECENT_CYCLES)
    .map(r => ({
      cycle: r.cycle,
      receipts: r.receipts ?? null,
      disbursements: r.disbursements ?? null,
      individualContributions: r.individual_contributions ?? null,
      pacContributions: r.other_political_committee_contributions ?? null,
      partyContributions: r.political_party_committee_contributions ?? null,
      cashOnHandEnd: r.last_cash_on_hand_end_period ?? null,
    }));
}

// Takes the candidate's PRINCIPAL COMMITTEE id, not the candidate_id.
// See file header: the real periodic financial reports live under the
// committee's own filing history, not the candidate's own filings list.
async function fetchFilings(committeeId) {
  const data = await fec(`/committee/${committeeId}/filings/`, {
    sort: "-receipt_date", per_page: FILINGS_LIMIT, form_category: "REPORT",
  });
  return (data.results || [])
    .filter(r => r.file_number)
    .map(r => ({
      fileNumber: r.file_number,
      reportType: r.report_type_full || r.report_type || null,
      coverageStart: r.coverage_start_date ? r.coverage_start_date.slice(0, 10) : null,
      coverageEnd: r.coverage_end_date ? r.coverage_end_date.slice(0, 10) : null,
      totalReceipts: r.total_receipts ?? null,
      totalDisbursements: r.total_disbursements ?? null,
      cashOnHandEnd: r.cash_on_hand_end_period ?? null,
      filedDate: r.receipt_date ? r.receipt_date.slice(0, 10) : null,
      pdfUrl: r.pdf_url || null,
    }));
}

async function fetchPrincipalCommitteeId(candidateId) {
  const data = await fec(`/candidate/${candidateId}/committees/`, { per_page: 20 });
  const committees = data.results || [];
  const principal = committees.find(c => c.designation === "P") || committees[0];
  return principal ? principal.committee_id : null;
}

async function fetchDonorBuckets(committeeId, cycle) {
  const [bySize, byState] = await Promise.all([
    fec("/schedules/schedule_a/by_size/", { committee_id: committeeId, cycle }),
    fec("/schedules/schedule_a/by_state/", { committee_id: committeeId, cycle }),
  ]);

  const rows = [];
  for (const r of (bySize.results || [])) {
    if (r.total == null) continue;
    rows.push({ bucketType: "size", bucketLabel: SIZE_LABELS[r.size] || `$${r.size}+`, totalAmount: r.total, donorCount: r.count ?? null });
  }
  for (const r of (byState.results || [])) {
    if (r.total == null || !r.state) continue;
    rows.push({ bucketType: "state", bucketLabel: r.state, totalAmount: r.total, donorCount: r.count ?? null });
  }
  return rows;
}

// ---- upserts ----
async function upsertTotals(candidateId, rows) {
  await sql.query(
    `INSERT INTO senator_finance_totals
       (fec_candidate_id, cycle, receipts, disbursements, individual_contributions,
        pac_contributions, party_contributions, cash_on_hand_end, synced_at)
     SELECT $1, *, now() FROM unnest(
       $2::int[], $3::numeric[], $4::numeric[], $5::numeric[], $6::numeric[], $7::numeric[], $8::numeric[]
     ) AS t(cycle, receipts, disbursements, individual_contributions, pac_contributions, party_contributions, cash_on_hand_end)
     ON CONFLICT (fec_candidate_id, cycle) DO UPDATE SET
       receipts = EXCLUDED.receipts, disbursements = EXCLUDED.disbursements,
       individual_contributions = EXCLUDED.individual_contributions,
       pac_contributions = EXCLUDED.pac_contributions, party_contributions = EXCLUDED.party_contributions,
       cash_on_hand_end = EXCLUDED.cash_on_hand_end, synced_at = now()`,
    [
      candidateId,
      rows.map(r => r.cycle),
      rows.map(r => r.receipts),
      rows.map(r => r.disbursements),
      rows.map(r => r.individualContributions),
      rows.map(r => r.pacContributions),
      rows.map(r => r.partyContributions),
      rows.map(r => r.cashOnHandEnd),
    ]
  );
}

async function upsertFilings(candidateId, rows) {
  await sql.query(
    `INSERT INTO senator_filings
       (fec_candidate_id, file_number, report_type, coverage_start, coverage_end,
        total_receipts, total_disbursements, cash_on_hand_end, filed_date, pdf_url, synced_at)
     SELECT $1, *, now() FROM unnest(
       $2::bigint[], $3::text[], $4::date[], $5::date[],
       $6::numeric[], $7::numeric[], $8::numeric[], $9::date[], $10::text[]
     ) AS t(file_number, report_type, coverage_start, coverage_end,
            total_receipts, total_disbursements, cash_on_hand_end, filed_date, pdf_url)
     ON CONFLICT (fec_candidate_id, file_number) DO UPDATE SET
       report_type = EXCLUDED.report_type, coverage_start = EXCLUDED.coverage_start,
       coverage_end = EXCLUDED.coverage_end, total_receipts = EXCLUDED.total_receipts,
       total_disbursements = EXCLUDED.total_disbursements, cash_on_hand_end = EXCLUDED.cash_on_hand_end,
       filed_date = EXCLUDED.filed_date, pdf_url = EXCLUDED.pdf_url, synced_at = now()`,
    [
      candidateId,
      rows.map(r => r.fileNumber),
      rows.map(r => r.reportType),
      rows.map(r => r.coverageStart),
      rows.map(r => r.coverageEnd),
      rows.map(r => r.totalReceipts),
      rows.map(r => r.totalDisbursements),
      rows.map(r => r.cashOnHandEnd),
      rows.map(r => r.filedDate),
      rows.map(r => r.pdfUrl),
    ]
  );
}

async function upsertDonorBuckets(candidateId, committeeId, cycle, rows) {
  await sql.query(
    `INSERT INTO senator_top_donors (fec_candidate_id, committee_id, cycle, bucket_type, bucket_label, total_amount, donor_count, synced_at)
     SELECT $1, $2, $3, *, now() FROM unnest(
       $4::text[], $5::text[], $6::numeric[], $7::int[]
     ) AS t(bucket_type, bucket_label, total_amount, donor_count)
     ON CONFLICT (fec_candidate_id, cycle, bucket_type, bucket_label) DO UPDATE SET
       total_amount = EXCLUDED.total_amount, donor_count = EXCLUDED.donor_count, synced_at = now()`,
    [
      candidateId, committeeId, cycle,
      rows.map(r => r.bucketType),
      rows.map(r => r.bucketLabel),
      rows.map(r => r.totalAmount),
      rows.map(r => r.donorCount),
    ]
  );
}

// ---- schema + cursor ----
async function ensureTables() {
  await sql`ALTER TABLE senators ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS senator_finance_totals (
      fec_candidate_id          TEXT NOT NULL,
      cycle                     INT NOT NULL,
      receipts                  NUMERIC,
      disbursements             NUMERIC,
      individual_contributions  NUMERIC,
      pac_contributions         NUMERIC,
      party_contributions       NUMERIC,
      cash_on_hand_end          NUMERIC,
      synced_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (fec_candidate_id, cycle)
    )`;
  await sql`
    CREATE TABLE IF NOT EXISTS senator_filings (
      fec_candidate_id     TEXT NOT NULL,
      file_number          BIGINT NOT NULL,
      report_type          TEXT,
      coverage_start       DATE,
      coverage_end         DATE,
      total_receipts       NUMERIC,
      total_disbursements  NUMERIC,
      cash_on_hand_end     NUMERIC,
      filed_date           DATE,
      pdf_url              TEXT,
      synced_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (fec_candidate_id, file_number)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_senator_filings_candidate_coverage ON senator_filings (fec_candidate_id, coverage_end DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS senator_top_donors (
      fec_candidate_id  TEXT NOT NULL,
      committee_id      TEXT NOT NULL,
      cycle             INT NOT NULL,
      bucket_type       TEXT NOT NULL,
      bucket_label      TEXT NOT NULL,
      total_amount      NUMERIC NOT NULL,
      donor_count       INT,
      synced_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
      PRIMARY KEY (fec_candidate_id, cycle, bucket_type, bucket_label)
    )`;
  await sql`CREATE INDEX IF NOT EXISTS idx_senator_top_donors_amount ON senator_top_donors (fec_candidate_id, total_amount DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

async function getCursor() {
  const rows = await sql`SELECT value FROM sync_state WHERE key = 'senfin_sync_cursor'`;
  return rows.length ? (rows[0].value || "") : "";
}
async function setCursor(bioguideId) {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('senfin_sync_cursor', ${bioguideId}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

async function fec(path, params = {}) {
  const qs = new URLSearchParams({ api_key: FEC_API_KEY, ...params });
  const r = await fetch(`${FEC_BASE}${path}?${qs}`);
  if (!r.ok) throw new Error(`FEC ${r.status} on ${path}`);
  return r.json();
}
