// Shared session lookup - session token to email, or null if missing/expired.
// Every vote-queue endpoint needs this same check, so it lives here once.
import { sql } from "./_db.js";

export async function resolveEmail(token) {
  if (!token) return null;
  const sess = await sql`
    SELECT email FROM sessions WHERE session_token=${token} AND session_expires > now()`;
  return sess.length ? sess[0].email : null;
}
