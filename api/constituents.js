// =============================================================================
// /api/constituents - PUBLIC constituent directory + public voter cards
//   GET /api/constituents                    -> list of public profiles (national)
//   GET /api/constituents?district=CO-04     -> list filtered to a district
//   GET /api/constituents?id=123             -> one public profile + vote record
//
// PRIVACY RULES (hard, server-side):
//   - Only profiles with is_public = true are EVER returned.
//   - Email is NEVER included in any response. The votes lookup happens
//     server-side via email, but only bill/position data leaves this handler.
//   - Flipping "Make Private" removes a profile from all of this instantly,
//     because every query re-checks is_public at read time.
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "s-maxage=30, stale-while-revalidate=60");

  try {
    const { id, district } = req.query;

    // ---- Single public profile + vote record ----
    if (id) {
      const rows = await sql`
        SELECT id, display_name, bio, city, district, created_at, email
        FROM profiles
        WHERE id = ${id} AND is_public = true`;
      if (!rows.length) return res.status(404).json({ error: "not_public_or_not_found" });
      const p = rows[0];

      // Votes are keyed by identity 'sess:{email}:{billId}' - resolve
      // server-side, return only bill data. Join cached summaries for a
      // human-readable headline when we have one.
      const votes = await sql`
        SELECT v.bill_id, v.position, v.tier, v.district, v.created_at,
               (SELECT bs.headline FROM bill_summaries bs
                 WHERE bs.bill_id = v.bill_id
                 ORDER BY bs.generated_at DESC LIMIT 1) AS headline
        FROM votes v
        WHERE v.identity LIKE ${"sess:" + p.email + ":%"}
          AND v.quarantined = FALSE
        ORDER BY v.created_at DESC
        LIMIT 100`;

      return res.status(200).json({
        id: p.id,
        display_name: p.display_name || "Anonymous Constituent",
        bio: p.bio || "",
        city: p.city || "",
        district: p.district || "",
        member_since: p.created_at,
        votes: votes.map(v => ({
          bill_id: v.bill_id,
          headline: v.headline || null,
          position: v.position,
          tier: v.tier,
          district: v.district,
          date: v.created_at,
        })),
      });
    }

    // ---- Directory listing ----
    const list = district
      ? await sql`
          SELECT p.id, p.display_name, p.bio, p.city, p.district, p.created_at,
                 (SELECT count(*)::int FROM votes v
                   WHERE v.identity LIKE 'sess:' || p.email || ':%'
                     AND v.quarantined = FALSE) AS vote_count
          FROM profiles p
          WHERE p.is_public = true AND p.district = ${district}
          ORDER BY vote_count DESC, p.created_at ASC
          LIMIT 100`
      : await sql`
          SELECT p.id, p.display_name, p.bio, p.city, p.district, p.created_at,
                 (SELECT count(*)::int FROM votes v
                   WHERE v.identity LIKE 'sess:' || p.email || ':%'
                     AND v.quarantined = FALSE) AS vote_count
          FROM profiles p
          WHERE p.is_public = true
          ORDER BY vote_count DESC, p.created_at ASC
          LIMIT 100`;

    return res.status(200).json({
      constituents: list.map(p => ({
        id: p.id,
        display_name: p.display_name || "Anonymous Constituent",
        bio: p.bio || "",
        city: p.city || "",
        district: p.district || "",
        vote_count: p.vote_count,
        member_since: p.created_at,
      })),
    });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
