// =============================================================================
// GET /api/sync-rep-finances - match every House member in the representatives
// table to its FEC candidate record, then mirror that candidate's per-cycle
// totals, FEC filings, and a bounded Schedule A donor breakdown into our own
// tables, so the Know Your Rep tab can show a full financial profile without
// hitting the FEC API on every page load.
//
// 435 members, each needing several FEC calls (candidate search, committee
// lookup, totals, filings, two Schedule A aggregates), does not fit inside one
// serverless invocation's time limit. So this resumes from a persisted cursor
// each call, the same resumable pattern as api/sync-bills.js: representatives
// are processed in district order, a batch is worked through until close to
// the time budget, the cursor is saved, and the next invocation continues from
// there. Reaching the end resets the cursor so the next call starts a fresh
// pass instead of needing a separate reset step. Call this by hand a few times
// to finish the initial catch up, same as sync-bills.js, then let the daily
// cron keep it fresh.
//
// MATCHING LIMITATION (do not silently paper over): FEC has no crosswalk from
// a House seat straight to a candidate_id, so matching is office+state+
// district plus a name match, exact last name first, falling back to a fuzzy
// last name match if nothing exact hits. A representative whose FEC filer
// name differs enough to miss both passes is logged and left unmatched rather
// than guessed at, the same as etl_irs_bmf.js does for its exact-name EIN
// crosswalk. Every unmatched representative is reported back in this
// endpoint's JSON response so a human can review and, if needed, patch
// representatives.fec_candidate_id by hand.
// =============================================================================
import { sql, hasDb } from "./_db.js";

const FEC_API_KEY = process.env.FEC_API_KEY;
const FEC_BASE = "https://api.open.fec.gov/v1";
const BATCH_SIZE = 6;             // representatives worked per invocation batch
const CONCURRENCY = 3;            // parallel representatives per batch, mindful of FEC rate limits
const RECENT_CYCLES = 3;          // how many of a candidate's most recent cycles to keep totals for
const FILINGS_LIMIT = 20;         // most recent filings kept per candidate (some incumbents have 100+)
const TIME_BUDGET_MS = 45000;     // leaves margin below the platform's hard invocation limit

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
    if (req.query.debug) {
      const steps = [];
      try { await sql`ALTER TABLE representatives ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT`; steps.push("alter:ok"); }
      catch (e) { steps.push("alter:fail:" + (e.message || e)); }
      try {
        const cols = await sql`SELECT column_name FROM information_schema.columns WHERE table_name = 'representatives' ORDER BY ordinal_position`;
        steps.push("columns:" + cols.map(c => c.column_name).join(","));
      } catch (e) { steps.push("columns:fail:" + (e.message || e)); }
      try {
        const test = await sql`SELECT district, fec_candidate_id FROM representatives LIMIT 1`;
        steps.push("select:ok:" + JSON.stringify(test));
      } catch (e) { steps.push("select:fail:" + (e.message || e)); }
      try {
        const cursor = await getCursor();
        const test2 = await sql`
          SELECT district, name, state, fec_candidate_id FROM representatives
          WHERE district > ${cursor} ORDER BY district ASC LIMIT ${BATCH_SIZE}`;
        steps.push("realquery:ok:" + JSON.stringify(test2) + " cursor=" + JSON.stringify(cursor));
      } catch (e) { steps.push("realquery:fail:" + (e.message || e)); }
      try {
        await ensureTables();
        steps.push("ensureTables:ok");
        const cursor3 = await getCursor();
        const test3 = await sql`
          SELECT district, name, state, fec_candidate_id FROM representatives
          WHERE district > ${cursor3} ORDER BY district ASC LIMIT ${BATCH_SIZE}`;
        steps.push("afterEnsureTables:ok:" + JSON.stringify(test3));
      } catch (e) { steps.push("afterEnsureTables:fail:" + (e.message || e)); }
      return res.status(200).json({ debug: true, steps });
    }

    await ensureTables();

    const cursor = await getCursor();
    let reps = await sql`
      SELECT district, name, state, fec_candidate_id FROM representatives
      WHERE district > ${cursor} ORDER BY district ASC LIMIT ${BATCH_SIZE}`;

    let reachedEnd = reps.length < BATCH_SIZE;
    let lastDistrict = cursor;
    let processed = 0;
    const unmatched = [];
    const fuzzyMatched = [];

    while (reps.length && !outOfTime()) {
      for (let i = 0; i < reps.length; i += CONCURRENCY) {
        const batch = reps.slice(i, i + CONCURRENCY);
        await Promise.allSettled(batch.map(rep => processRep(rep, { unmatched, fuzzyMatched })));
        processed += batch.length;
      }
      lastDistrict = reps[reps.length - 1].district;
      if (reachedEnd || outOfTime()) break;

      reps = await sql`
        SELECT district, name, state, fec_candidate_id FROM representatives
        WHERE district > ${lastDistrict} ORDER BY district ASC LIMIT ${BATCH_SIZE}`;
      reachedEnd = reps.length < BATCH_SIZE;
    }

    await setCursor(reachedEnd ? "" : lastDistrict);

    return res.status(200).json({
      ok: true,
      processed,
      resumeAtDistrict: reachedEnd ? "" : lastDistrict,
      passComplete: reachedEnd,
      unmatched,
      fuzzyMatched,
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_failed", detail: String(err.message || err) });
  }
}

async function processRep(rep, log) {
  try {
    let candidateId = rep.fec_candidate_id;

    if (!candidateId) {
      const match = await matchCandidate(rep);
      if (!match) {
        console.warn(`[sync-rep-finances] no FEC match for ${rep.district} ${rep.name}`);
        log.unmatched.push({ district: rep.district, name: rep.name });
        return;
      }
      candidateId = match.candidateId;
      if (match.fuzzy) {
        console.warn(`[sync-rep-finances] fuzzy match for ${rep.district} ${rep.name} -> ${candidateId} (${match.fecName})`);
        log.fuzzyMatched.push({ district: rep.district, name: rep.name, candidateId, fecName: match.fecName });
      }
      await sql`UPDATE representatives SET fec_candidate_id = ${candidateId} WHERE district = ${rep.district}`;
    }

    const totals = await fetchTotals(candidateId);
    if (totals.length) await upsertTotals(candidateId, totals);

    const filings = await fetchFilings(candidateId);
    if (filings.length) await upsertFilings(candidateId, filings);

    const committeeId = await fetchPrincipalCommitteeId(candidateId);
    const latestCycle = totals[0]?.cycle;
    if (committeeId && latestCycle) {
      const buckets = await fetchDonorBuckets(committeeId, latestCycle);
      if (buckets.length) await upsertDonorBuckets(candidateId, committeeId, latestCycle, buckets);
    }
  } catch (err) {
    console.warn(`[sync-rep-finances] failed processing ${rep.district} ${rep.name}: ${err.message || err}`);
  }
}

// ---- FEC candidate matching ----
async function matchCandidate(rep) {
  const [state, distPart] = String(rep.district || "").split("-");
  if (!state || !distPart) return null;
  const distCode = distPart === "AL" ? "00" : distPart;

  const data = await fec("/candidates/", { office: "H", state, district: distCode, per_page: 100 });
  const candidates = data.results || [];
  if (!candidates.length) return null;

  const repLast = lastName(rep.name);
  const exact = candidates.filter(c => lastName(fecFirstLast(c.name).last) === repLast);
  const pick = (list) => list.sort((a, b) => (maxCycle(b) - maxCycle(a)) || (a.candidate_inactive ? 1 : -1))[0];

  if (exact.length) return { candidateId: pick(exact).candidate_id, fuzzy: false };

  // Fuzzy fallback: same first four letters of the last name, the same
  // bounded approach used elsewhere in this codebase rather than a full
  // edit-distance match that could silently pick the wrong person.
  const prefix = repLast.slice(0, 4);
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

async function fetchFilings(candidateId) {
  const data = await fec(`/candidate/${candidateId}/filings/`, { sort: "-receipt_date", per_page: FILINGS_LIMIT });
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
    `INSERT INTO rep_finance_totals
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
    `INSERT INTO rep_filings
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
    `INSERT INTO rep_top_donors (fec_candidate_id, committee_id, cycle, bucket_type, bucket_label, total_amount, donor_count, synced_at)
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
  await sql`ALTER TABLE representatives ADD COLUMN IF NOT EXISTS fec_candidate_id TEXT`;
  await sql`
    CREATE TABLE IF NOT EXISTS rep_finance_totals (
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
    CREATE TABLE IF NOT EXISTS rep_filings (
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
  await sql`CREATE INDEX IF NOT EXISTS idx_rep_filings_candidate_coverage ON rep_filings (fec_candidate_id, coverage_end DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS rep_top_donors (
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
  await sql`CREATE INDEX IF NOT EXISTS idx_rep_top_donors_amount ON rep_top_donors (fec_candidate_id, total_amount DESC)`;
  await sql`
    CREATE TABLE IF NOT EXISTS sync_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}

async function getCursor() {
  const rows = await sql`SELECT value FROM sync_state WHERE key = 'repfin_sync_cursor'`;
  return rows.length ? (rows[0].value || "") : "";
}
async function setCursor(district) {
  await sql`
    INSERT INTO sync_state (key, value, updated_at)
    VALUES ('repfin_sync_cursor', ${district}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

async function fec(path, params = {}) {
  const qs = new URLSearchParams({ api_key: FEC_API_KEY, ...params });
  const r = await fetch(`${FEC_BASE}${path}?${qs}`);
  if (!r.ok) throw new Error(`FEC ${r.status} on ${path}`);
  return r.json();
}
