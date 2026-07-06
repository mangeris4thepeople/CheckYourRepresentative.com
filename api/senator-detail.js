// =============================================================================
// GET /api/senator-detail?bioguideId=A000382
//
// Full Know Your Rep profile for one senator: bio fields, per-cycle FEC
// financial totals, every FEC filing on record with its PDF link, and a
// bounded top-donor breakdown. Mirrors api/representative-detail.js exactly;
// senators have no district, so bioguide_id is the lookup key instead.
// Returns ready:false if the senator has not been matched to an FEC
// candidate yet (see api/sync-senator-finances.js).
// =============================================================================
import { sql, hasDb } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  const bioguideId = String(req.query.bioguideId || "").trim().toUpperCase();
  if (!bioguideId) return res.status(400).json({ error: "bioguideId required" });

  try {
    const sen = (await sql`
      SELECT bioguide_id, name, party, state, class, phone, website, contact_url, fec_candidate_id
      FROM senators WHERE bioguide_id = ${bioguideId}`)[0];
    if (!sen) return res.status(404).json({ error: "senator not found" });

    if (!sen.fec_candidate_id) {
      return res.status(200).json({ ready: true, sen, matched: false, totals: [], filings: [], topDonors: [] });
    }

    const candidateId = sen.fec_candidate_id;
    const totals = await sql`
      SELECT cycle, receipts, disbursements, individual_contributions,
             pac_contributions, party_contributions, cash_on_hand_end
      FROM senator_finance_totals WHERE fec_candidate_id = ${candidateId}
      ORDER BY cycle DESC`;

    const filings = await sql`
      SELECT file_number, report_type, coverage_start, coverage_end,
             total_receipts, total_disbursements, cash_on_hand_end, filed_date, pdf_url
      FROM senator_filings WHERE fec_candidate_id = ${candidateId}
      ORDER BY coverage_end DESC NULLS LAST`;

    const topDonors = await sql`
      SELECT cycle, bucket_type, bucket_label, total_amount, donor_count
      FROM senator_top_donors WHERE fec_candidate_id = ${candidateId}
      ORDER BY total_amount DESC`;

    return res.status(200).json({ ready: true, sen, matched: true, totals, filings, topDonors });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "senator_detail_failed", detail: msg });
  }
}
