// Shared session lookup - session token to email, or null if missing/expired.
// Every vote-queue endpoint needs this same check, so it lives here once.
import { sql } from "./_db.js";

export async function resolveEmail(token) {
  if (!token) return null;
  const sess = await sql`
    SELECT email FROM sessions WHERE session_token=${token} AND session_expires > now()`;
  return sess.length ? sess[0].email : null;
}

// votes.identity is "sess:{email}:{billId}". When matching by email with
// LIKE, the email must be escaped: '_' and '%' are LIKE wildcards, so an
// address like john_doe@x.com would otherwise also match johnXdoe@x.com -
// leaking another account's votes. Use this for every identity LIKE match.
export function likeEscape(s) {
  return String(s).replace(/([\\%_])/g, "\\$1");
}

// The canonical prefix pattern for all of one account's votes.
export function identityPrefix(email) {
  return `sess:${likeEscape(email)}:%`;
}
