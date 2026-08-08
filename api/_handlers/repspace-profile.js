// =============================================================================
// GET /api/repspace/profile?bioguide=D000197 - one member's full RepSpace page.
//
// Returns the member row, vote stats, committees (the Top 8), FEC donor
// buckets with receipt links, the wall (verbatim official-record items,
// every one with a source_url), and the auto-generated headline.
//
// The headline system: rs_headline_rules rows can only enable, disable, and
// reorder the rule keys implemented in HEADLINE_TEMPLATES below. The
// database carries no headline text and unknown keys are ignored, so no row
// anywhere can produce freeform text that might read as a quote from the
// member. Every response also carries HEADLINE_DISCLAIMER, which the
// frontend must render next to the headline. Do not remove it.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export const HEADLINE_DISCLAIMER =
  "Headline generated automatically from public records. Not a quote from or statement by this member.";

// rule_key -> { test, text }. text() must state a verifiable fact drawn from
// the record it is computed from, phrased in the third person, never in the
// member's voice.
const HEADLINE_TEMPLATES = {
  "perfect-attendance": {
    test: (m, s) => s && s.votes_total >= 25 && s.votes_missed === 0,
    text: (m, s) => `Has not missed a recorded vote this session (${s.votes_cast} of ${s.votes_total})`,
  },
  "missed-votes": {
    test: (m, s) => s && s.votes_total >= 25 && s.votes_missed / s.votes_total >= 0.05,
    text: (m, s) => `Missed ${Math.round((s.votes_missed / s.votes_total) * 100)}% of recorded votes this session (${s.votes_missed} of ${s.votes_total})`,
  },
  "high-attendance": {
    test: (m, s) => s && s.votes_total >= 25 && s.votes_missed / s.votes_total <= 0.02,
    text: (m, s) => `Present for ${s.votes_cast} of ${s.votes_total} recorded votes this session`,
  },
  "freshman": {
    test: (m) => m.first_term_start && yearsSince(m.first_term_start) < 2,
    text: (m) => `New to Congress, first sworn in ${String(m.first_term_start).slice(0, 4)}`,
  },
  "long-timer": {
    test: (m) => m.first_term_start && yearsSince(m.first_term_start) >= 20,
    text: (m) => `In Congress since ${String(m.first_term_start).slice(0, 4)}, ${Math.floor(yearsSince(m.first_term_start))} years and counting`,
  },
  "default": {
    test: () => true,
    text: (m) => m.chamber === "senate"
      ? `United States Senator for ${m.state}`
      : `Representative for ${m.district || m.state}`,
  },
};

function yearsSince(dateStr) {
  return (Date.now() - new Date(dateStr).getTime()) / (365.25 * 24 * 3600 * 1000);
}

export function buildHeadline(member, stats, rules) {
  const ordered = (rules || [])
    .filter(r => r.enabled && HEADLINE_TEMPLATES[r.rule_key])
    .sort((a, b) => a.priority - b.priority);
  for (const r of ordered) {
    const t = HEADLINE_TEMPLATES[r.rule_key];
    try {
      if (t.test(member, stats)) return { rule: r.rule_key, text: t.text(member, stats) };
    } catch {
      // A broken rule must never take the profile down; fall through.
    }
  }
  const d = HEADLINE_TEMPLATES.default;
  return { rule: "default", text: d.text(member, stats) };
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=1800, stale-while-revalidate=3600");
  if (!hasDb) return res.status(200).json({ ready: false, reason: "no_database" });

  try {
    const bioguide = String(req.query.bioguide || "").trim();
    if (!/^[A-Z]\d{6}$/.test(bioguide)) return res.status(400).json({ error: "bioguide required" });

    const member = (await sql`
      SELECT bioguide_id, first_name, last_name, full_name, chamber, state, district,
             party, birthday, first_term_start, term_start, term_end,
             phone, website, contact_form, photo_url, active
      FROM rs_members WHERE bioguide_id = ${bioguide}`)[0];
    if (!member) return res.status(404).json({ error: "member not found" });

    const [stats] = await sql`
      SELECT congress, votes_total, votes_cast, votes_missed, yes_votes, no_votes,
             present_votes, last_vote_date
      FROM rs_stats WHERE bioguide_id = ${bioguide}`;

    const committees = await sql`
      SELECT committee_code, committee_name, subcommittee, role, rank
      FROM rs_committees WHERE bioguide_id = ${bioguide}
      ORDER BY (subcommittee = '') DESC, rank NULLS LAST, committee_name`;

    const donors = await sql`
      SELECT cycle, bucket_type, bucket_label, total_amount, donor_count, source_url
      FROM rs_top_donors WHERE bioguide_id = ${bioguide}
      ORDER BY cycle DESC, total_amount DESC LIMIT 16`;

    const wall = await sql`
      SELECT posted_at, kind, title, body, source_url
      FROM rs_wall_posts WHERE bioguide_id = ${bioguide}
      ORDER BY posted_at DESC NULLS LAST, id DESC LIMIT 10`;

    const rules = await sql`SELECT rule_key, enabled, priority FROM rs_headline_rules`;
    const headline = buildHeadline(member, stats || null, rules);

    return res.status(200).json({
      ready: true, member, stats: stats || null, committees, donors, wall,
      headline, disclaimer: HEADLINE_DISCLAIMER,
    });
  } catch (err) {
    const msg = String(err.message || err);
    if (/relation .* does not exist/i.test(msg)) {
      return res.status(200).json({ ready: false, reason: "schema_not_migrated" });
    }
    return res.status(500).json({ error: "repspace_profile_failed", detail: msg });
  }
}
