// =============================================================================
// GET /api/representative-detail?district=CO-04
//
// Full Know Your Rep profile for one House member: bio fields, per-cycle FEC
// financial totals, every FEC filing on record with its PDF link, and a
// bounded top-donor breakdown. Returns ready:false if the representative has
// not been matched to an FEC candidate yet (see api/sync-rep-finances.js).
// =============================================================================
import { sql, hasDb } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  const district = String(req.query.district || "").trim().toUpperCase();
  if (!district) return res.status(400).json({ error: "district required" });

  try {
    const rep = (await sql`
      SELECT district, name, party, state, phone, website, contact_url, fec_candidate_id
      FROM representatives WHERE district = ${district}`)[0];
    if (!rep) return res.status(404).json({ error: "representative not found" });

    if (!rep.fec_candidate_id) {
      return res.status(200).json({ ready: true, rep, matched: false, totals: [], filings: [], topDonors: [] });
    }

    const candidateId = rep.fec_candidate_id;
    const totals = await sql`
      SELECT cycle, receipts, disbursements, individual_contributions,
             pac_contributions, party_contributions, cash_on_hand_end
      FROM rep_finance_totals WHERE fec_candidate_id = ${candidateId}
      ORDER BY cycle DESC`;

    const filings = await sql`
      SELECT file_number, report_type, coverage_start, coverage_end,
             total_receipts, total_disbursements, cash_on_hand_end, filed_date, pdf_url
      FROM rep_filings WHERE fec_candidate_id = ${candidateId}
      ORDER BY coverage_end DESC NULLS LAST`;

    const topDonors = await sql`
      SELECT cycle, bucket_type, bucket_label, total_amount, donor_count
      FROM rep_top_donors WHERE fec_candidate_id = ${candidateId}
      ORDER BY total_amount DESC`;

    return res.status(200).json({ ready: true, rep, matched: true, totals, filings, topDonors });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "representative_detail_failed", detail: msg });
  }
}
