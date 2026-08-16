// =============================================================================
// GET /api/report-card?bioguide=M001153 - the Representative Report Card.
//
// One card, four sections, every number a verifiable public fact:
//   1. TENURE        - in office since X (rs_members.first_term_start)
//   2. THE MONEY     - per-cycle FEC totals (rep/senator finance tables)
//   3. WHO PROVIDED  - FEC's own donor aggregates (rs_top_donors)
//   4. THE RECORD    - attendance (rs_stats), committees, sponsored bills
//                      (rs_wall_posts + cached Congress.gov total)
//
// No letter grades, no editorial scores: the headline asks the question,
// the public record answers it. Sources ride along on every section.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  // Look up by bioguide (canonical) or by House district (what the Know Your
  // Rep tab has in hand) - rs_members carries both.
  const bioguideParam = String(req.query.bioguide || "").trim();
  const districtParam = String(req.query.district || "").trim().toUpperCase();
  if (!/^[A-Z]\d{6}$/.test(bioguideParam) && !districtParam) {
    return res.status(400).json({ error: "bioguide or district required" });
  }

  try {
    const member = (/^[A-Z]\d{6}$/.test(bioguideParam)
      ? (await sql`
          SELECT bioguide_id, full_name, first_name, last_name, chamber, state,
                 district, party, first_term_start, term_start, term_end,
                 phone, website, photo_url
          FROM rs_members WHERE bioguide_id = ${bioguideParam} AND active`)
      : (await sql`
          SELECT bioguide_id, full_name, first_name, last_name, chamber, state,
                 district, party, first_term_start, term_start, term_end,
                 phone, website, photo_url
          FROM rs_members WHERE district = ${districtParam} AND chamber = 'house' AND active
          LIMIT 1`))[0];
    if (!member) return res.status(404).json({ error: "member not found" });
    const bioguide = member.bioguide_id;

    // ---- 1. Tenure ----
    const since = member.first_term_start ? new Date(member.first_term_start) : null;
    const years = since ? Math.floor((Date.now() - since.getTime()) / (365.25 * 24 * 3600 * 1000)) : null;

    // ---- 4a. Attendance ----
    const stats = (await sql`
      SELECT congress, votes_total, votes_cast, votes_missed, last_vote_date
      FROM rs_stats WHERE bioguide_id = ${bioguide}`)[0] || null;

    // ---- 2. The Money (chamber-specific finance tables) ----
    let totals = [];
    try {
      if (member.chamber === "senate") {
        const sen = (await sql`SELECT fec_candidate_id FROM senators WHERE bioguide_id = ${bioguide}`)[0];
        if (sen?.fec_candidate_id) {
          totals = await sql`
            SELECT cycle, receipts, disbursements, individual_contributions,
                   pac_contributions, cash_on_hand_end
            FROM senator_finance_totals WHERE fec_candidate_id = ${sen.fec_candidate_id}
            ORDER BY cycle DESC LIMIT 4`;
        }
      } else if (member.district) {
        const rep = (await sql`SELECT fec_candidate_id FROM representatives WHERE district = ${member.district}`)[0];
        if (rep?.fec_candidate_id) {
          totals = await sql`
            SELECT cycle, receipts, disbursements, individual_contributions,
                   pac_contributions, cash_on_hand_end
            FROM rep_fec_totals WHERE fec_candidate_id = ${rep.fec_candidate_id}
            ORDER BY cycle DESC LIMIT 4`;
        }
      }
    } catch { /* finance tables not provisioned: card still renders */ }

    // ---- 3. Who Provided It (FEC's own aggregates, latest cycle on file) ----
    let donors = [];
    try {
      donors = await sql`
        SELECT cycle, bucket_type, bucket_label, total_amount, donor_count, source_url
        FROM rs_top_donors
        WHERE bioguide_id = ${bioguide}
          AND cycle = (SELECT max(cycle) FROM rs_top_donors WHERE bioguide_id = ${bioguide})
        ORDER BY total_amount DESC LIMIT 12`;
    } catch { /* absent table tolerated */ }

    // ---- 4b. Committees + recent sponsored bills ----
    let committees = [], recentBills = [];
    try {
      committees = await sql`
        SELECT committee_name, subcommittee, role
        FROM rs_committees WHERE bioguide_id = ${bioguide}
        ORDER BY rank NULLS LAST LIMIT 6`;
    } catch {}
    try {
      recentBills = await sql`
        SELECT posted_at, title, source_url
        FROM rs_wall_posts
        WHERE bioguide_id = ${bioguide} AND kind = 'sponsored-bill'
        ORDER BY posted_at DESC NULLS LAST LIMIT 5`;
    } catch {}

    // ---- 4c. Total sponsored count, cached in rs_stats (7-day refresh) ----
    let sponsoredTotal = null;
    try {
      await sql`ALTER TABLE rs_stats ADD COLUMN IF NOT EXISTS sponsored_total INT`;
      await sql`ALTER TABLE rs_stats ADD COLUMN IF NOT EXISTS sponsored_synced_at TIMESTAMPTZ`;
      const cached = (await sql`
        SELECT sponsored_total, sponsored_synced_at FROM rs_stats
        WHERE bioguide_id = ${bioguide}`)[0];
      const fresh = cached?.sponsored_synced_at &&
        (Date.now() - new Date(cached.sponsored_synced_at).getTime()) < 7 * 24 * 3600 * 1000;
      if (fresh && cached.sponsored_total != null) {
        sponsoredTotal = cached.sponsored_total;
      } else if (CONGRESS_API_KEY) {
        const r = await fetch(
          `https://api.congress.gov/v3/member/${bioguide}/sponsored-legislation?format=json&limit=1&api_key=${CONGRESS_API_KEY}`);
        if (r.ok) {
          const d = await r.json();
          sponsoredTotal = d?.pagination?.count ?? null;
          if (sponsoredTotal != null) {
            await sql`
              INSERT INTO rs_stats (bioguide_id, sponsored_total, sponsored_synced_at)
              VALUES (${bioguide}, ${sponsoredTotal}, now())
              ON CONFLICT (bioguide_id) DO UPDATE SET
                sponsored_total = ${sponsoredTotal}, sponsored_synced_at = now()`;
          }
        } else if (cached?.sponsored_total != null) {
          sponsoredTotal = cached.sponsored_total; // stale beats nothing
        }
      }
    } catch { /* count is optional */ }

    // ---- District engagement on this site ----
    let districtVotes = null;
    try {
      if (member.chamber === "house" && member.district) {
        districtVotes = (await sql`
          SELECT count(*)::int AS positions, count(DISTINCT bill_id)::int AS bills
          FROM votes WHERE district = ${member.district} AND quarantined = FALSE`)[0];
      } else {
        districtVotes = (await sql`
          SELECT count(*)::int AS positions, count(DISTINCT bill_id)::int AS bills
          FROM votes WHERE split_part(district, '-', 1) = ${member.state} AND quarantined = FALSE`)[0];
      }
    } catch {}

    return res.status(200).json({
      ready: true,
      member: {
        bioguide_id: member.bioguide_id,
        name: member.full_name,
        chamber: member.chamber,
        state: member.state,
        district: member.district,
        party: member.party,
        photo_url: member.photo_url,
        website: member.website,
        phone: member.phone,
      },
      tenure: {
        since: member.first_term_start,
        years,
        currentTermEnds: member.term_end,
      },
      money: { totals },
      donors,
      record: {
        attendance: stats && stats.votes_total > 0 ? {
          congress: stats.congress,
          votesTotal: stats.votes_total,
          votesCast: stats.votes_cast,
          votesMissed: stats.votes_missed,
          pctCast: Math.round((stats.votes_cast / stats.votes_total) * 1000) / 10,
          lastVoteDate: stats.last_vote_date,
        } : null,
        sponsoredTotal,
        recentBills,
        committees,
      },
      districtVotes,
      sources: {
        tenure: `https://bioguide.congress.gov/search/bio/${bioguide}`,
        money: "https://www.fec.gov/data/",
        record: `https://www.congress.gov/member/${bioguide}`,
      },
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    console.error("report-card:", err);
    return res.status(500).json({ error: "report_card_failed" });
  }
}
