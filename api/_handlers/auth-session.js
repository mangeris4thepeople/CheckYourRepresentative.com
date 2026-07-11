// GET /api/auth/session?token=xxx - validate session, return profile
// POST /api/auth/session - update profile fields
// DELETE /api/auth/session?token=xxx - logout
import { sql } from "../_db.js";

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  const token = req.query.token || req.body?.token;
  if (!token) return res.status(401).json({ error: "no token" });

  if (req.method === "DELETE") {
    await sql`UPDATE sessions SET session_token = NULL, session_expires = NULL WHERE session_token = ${token}`;
    return res.status(200).json({ ok: true });
  }

  // Validate session
  const rows = await sql`
    SELECT s.email, s.session_expires, p.id, p.district, p.location, p.topics,
           p.email_channel, p.is_public, p.display_name, p.bio, p.city
    FROM sessions s
    LEFT JOIN profiles p ON p.email = s.email
    WHERE s.session_token = ${token} AND s.session_expires > now()`;

  if (!rows.length) return res.status(401).json({ error: "invalid or expired session" });
  const user = rows[0];

  if (req.method === "POST") {
    // Update profile fields
    const { district, location, topics, is_public, display_name, bio, city, email_channel } = req.body || {};
    await sql`
      UPDATE profiles SET
        district      = COALESCE(${district ?? null}, district),
        location      = COALESCE(${location ? JSON.stringify(location) : null}::jsonb, location),
        topics        = COALESCE(${topics ? JSON.stringify(topics) : null}::jsonb, topics),
        is_public     = COALESCE(${is_public ?? null}, is_public),
        display_name  = COALESCE(${display_name ?? null}, display_name),
        bio           = COALESCE(${bio ?? null}, bio),
        city          = COALESCE(${city ?? null}, city),
        email_channel = COALESCE(${email_channel ?? null}, email_channel)
      WHERE email = ${user.email}`;
    return res.status(200).json({ ok: true });
  }

  // GET - return profile + recent votes (capped preview) + full totals
  const votes = await sql`
    SELECT bill_id, position, tier, district, created_at
    FROM votes WHERE identity LIKE ${'sess:' + user.email + '%'}
    ORDER BY created_at DESC LIMIT 50`;

  // votes.identity is "sess:{email}:{billId}" (see api/vote.js), so the
  // colon-terminated prefix below is the precise match; the preview query
  // above is left exactly as it already was.
  const identityPrefix = `sess:${user.email}:%`;
  const totalVotesRows = await sql`
    SELECT count(*)::int AS n FROM votes WHERE identity LIKE ${identityPrefix}`;
  const totalVotes = totalVotesRows[0]?.n ?? 0;

  const voteTally = await sql`
    SELECT split_part(bill_id, '-', 1) AS bill_type, count(*)::int AS n
    FROM votes WHERE identity LIKE ${identityPrefix}
    GROUP BY 1 ORDER BY n DESC`;

  return res.status(200).json({
    email: user.email,
    profileId: user.id,
    district: user.district,
    location: user.location,
    topics: user.topics,
    is_public: user.is_public,
    display_name: user.display_name,
    bio: user.bio,
    city: user.city,
    email_channel: user.email_channel,
    votes,
    totalVotes,
    voteTally,
    sessionExpires: user.session_expires,
  });
}
