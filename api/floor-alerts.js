// =============================================================================
// GET /api/floor-alerts - cron job. Finds bills newly moving on the floor,
// emails every profile that opted into "floor_alerts", records each bill so
// it never alerts twice. Protected by CRON_SECRET like daily-report.
//
// "New on the floor" = bills with the most recent latestAction from
// Congress.gov (same source the Vote tab uses), that we have not alerted
// on before. Capped per run so a busy legislative day cannot flood inboxes.
// =============================================================================
import { sql } from "./_db.js";

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const CRON_SECRET = process.env.CRON_SECRET;
const SITE_URL = process.env.SITE_URL || "https://checkyourrepresentative.com";
const CONGRESS = 119;
const MAX_BILLS_PER_RUN = 3;      // at most 3 bill alerts per run
const MAX_RECIPIENTS = 2000;      // safety ceiling while the list is young

export default async function handler(req, res) {
  // Vercel cron sends Authorization: Bearer CRON_SECRET
  const auth = req.headers.authorization || "";
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return res.status(401).json({ error: "unauthorized" });
  }
  if (!CONGRESS_API_KEY || !RESEND_API_KEY) {
    return res.status(500).json({ error: "missing CONGRESS_API_KEY or RESEND_API_KEY" });
  }

  try {
    // Who wants these alerts
    const subscribers = await sql`
      SELECT email FROM profiles
      WHERE email_channel = 'floor_alerts'
      LIMIT ${MAX_RECIPIENTS}`;
    if (!subscribers.length) {
      return res.status(200).json({ ok: true, sent: 0, reason: "no_subscribers" });
    }

    // Recent floor activity from Congress.gov, same feed the Vote tab uses
    const qs = new URLSearchParams({
      format: "json", sort: "latestAction", direction: "desc",
      limit: "25", api_key: CONGRESS_API_KEY,
    });
    const r = await fetch(`https://api.congress.gov/v3/bill/${CONGRESS}?${qs}`);
    if (!r.ok) throw new Error(`congress.gov ${r.status}`);
    const data = await r.json();
    const bills = (data.bills || []).map(b => ({
      billId: `${(b.type || "").toLowerCase()}-${b.number}-${CONGRESS}`,
      label: `${b.type} ${b.number}`,
      title: b.title || "",
      action: b.latestAction?.text || "",
      actionDate: b.latestAction?.actionDate || "",
    }));

    // Which of these have we never alerted on
    const fresh = [];
    for (const bill of bills) {
      if (fresh.length >= MAX_BILLS_PER_RUN) break;
      const seen = await sql`SELECT 1 FROM floor_alerts_sent WHERE bill_id = ${bill.billId}`;
      if (!seen.length) fresh.push(bill);
    }
    if (!fresh.length) {
      return res.status(200).json({ ok: true, sent: 0, reason: "nothing_new" });
    }

    // Prefer a cached plain-English summary if the site already made one
    for (const bill of fresh) {
      const hit = await sql`
        SELECT headline, plain FROM bill_summaries
        WHERE bill_id = ${bill.billId}
        ORDER BY generated_at DESC LIMIT 1`;
      if (hit.length) {
        bill.headline = hit[0].headline;
        try { const j = JSON.parse(hit[0].plain); bill.plain = j.plain || hit[0].plain; }
        catch { bill.plain = hit[0].plain; }
      }
    }

    // One email covering the new bills, sent to each subscriber
    const subject = fresh.length === 1
      ? `New bill on the floor: ${fresh[0].headline || fresh[0].label}`
      : `${fresh.length} new bills are moving in Congress`;
    const html = buildEmail(fresh);

    let sent = 0;
    // Resend batch endpoint takes up to 100 messages per call
    for (let i = 0; i < subscribers.length; i += 100) {
      const chunk = subscribers.slice(i, i + 100).map(s => ({
        from: "CheckYourRepresentative <noreply@checkyourrepresentative.com>",
        to: s.email,
        subject,
        html,
      }));
      const br = await fetch("https://api.resend.com/emails/batch", {
        method: "POST",
        headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      if (br.ok) sent += chunk.length;
      else console.error("resend batch failed:", br.status, await br.text().catch(() => ""));
    }

    // Record the bills so they never alert twice
    for (const bill of fresh) {
      await sql`
        INSERT INTO floor_alerts_sent (bill_id, recipients)
        VALUES (${bill.billId}, ${sent})
        ON CONFLICT (bill_id) DO NOTHING`;
    }

    return res.status(200).json({ ok: true, sent, bills: fresh.map(b => b.billId) });
  } catch (err) {
    console.error("floor-alerts error:", err);
    return res.status(500).json({ error: String(err.message || err) });
  }
}

function buildEmail(bills) {
  const rows = bills.map(b => `
    <div style="background:#fff;border:1px solid #D8C9A0;border-radius:6px;padding:16px 18px;margin-bottom:12px">
      <div style="font-family:'Courier New',monospace;font-size:11px;color:#5C5347;margin-bottom:4px">${esc(b.label)}${b.actionDate ? " · " + esc(b.actionDate) : ""}</div>
      <div style="font-size:16px;font-weight:700;color:#0A1A3F;margin-bottom:6px">${esc(b.headline || b.title)}</div>
      ${b.plain ? `<div style="font-size:13.5px;color:#1A1A1A;line-height:1.6;margin-bottom:6px">${esc(b.plain)}</div>` : ""}
      <div style="font-size:12px;color:#5C5347">Latest action: ${esc(b.action)}</div>
    </div>`).join("");

  return `
  <div style="font-family:Georgia,serif;max-width:560px;margin:0 auto;padding:28px 22px;background:#FBF7EC;border:1px solid #D8C9A0;border-radius:8px">
    <div style="text-align:center;margin-bottom:20px">
      <div style="font-size:24px;font-weight:900;color:#0A1A3F">Check Your Representative</div>
      <div style="font-size:11px;color:#C9A227;letter-spacing:2px;font-weight:700">NEW BILLS ON THE FLOOR</div>
    </div>
    ${rows}
    <div style="text-align:center;margin:24px 0 8px">
      <a href="${SITE_URL}" style="display:inline-block;background:#8B0000;color:#fff;font-family:Georgia,serif;font-size:15px;font-weight:700;padding:13px 34px;border-radius:6px;text-decoration:none">
        Read the Money Trail and Cast Your Position →
      </a>
    </div>
    <p style="font-size:11px;color:#5C5347;text-align:center;line-height:1.5;margin-top:18px">
      You get these because your profile is set to floor alerts.<br/>
      Change it anytime in My Profile at CheckYourRepresentative.com.
    </p>
    <div style="border-top:1px solid #D8C9A0;margin-top:18px;padding-top:14px;text-align:center;font-size:10.5px;color:#9B8C75">
      CheckYourRepresentative.com · Paid for by We The People Inc.
    </div>
  </div>`;
}

function esc(s) {
  return String(s || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
