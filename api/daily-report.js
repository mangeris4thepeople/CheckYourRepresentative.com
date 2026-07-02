// built: 1782718293
// =============================================================================
// /api/daily-report.js - daily accountability email to representatives
// Cron: runs every day at 11:00 UTC (6AM ET / 7AM ET daylight)
// =============================================================================
import { sql } from "./_db.js";

const CONGRESS_KEY = process.env.CONGRESS_API_KEY;
const RESEND_KEY   = process.env.RESEND_API_KEY;

export const config = { maxDuration: 60 };

export default async function handler(req, res) {
  if (!RESEND_KEY) return res.status(500).json({ error: "RESEND_API_KEY not set" });

  try {
    const districts = await sql`
      SELECT DISTINCT district FROM votes
      WHERE district IS NOT NULL
      AND created_at > now() - interval '30 days'
      AND quarantined = FALSE
      ORDER BY district
      LIMIT 50
    `;

    const results = [];

    for (const { district } of districts) {
      const rows = await sql`
        SELECT
          v.bill_id,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'support')   AS support_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'oppose')    AS oppose_votes,
          COUNT(DISTINCT v.identity) FILTER (WHERE v.position = 'undecided') AS undecided_votes,
          COUNT(DISTINCT v.identity)                                            AS total_votes,
          COUNT(DISTINCT c.identity)                                            AS contacted_rep
        FROM votes v
        LEFT JOIN contact_actions c
          ON c.bill_id = v.bill_id AND c.district = v.district AND c.identity = v.identity
        WHERE v.quarantined = FALSE AND v.district = ${district}
        GROUP BY v.bill_id
        ORDER BY total_votes DESC
        LIMIT 20
      `;

      if (!rows.length) continue;

      // Get rep from our database
      const reps = await sql`
        SELECT * FROM representatives WHERE district = ${district} LIMIT 1
      `;
      const rep = reps[0];
      if (!rep) continue;

      const html = buildEmail(district, rep, rows);
      const sent = await sendEmail(rep, district, html);
      results.push({ district, rep: rep.name, sent });
    }

    // Also send summary to admin
    const adminHtml = buildAdminSummary(results);
    await sendAdminEmail(adminHtml, results.length);

    return res.status(200).json({ ok: true, sent: results.length, results });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}

async function sendEmail(rep, district, html) {
  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_KEY,
      },
      body: JSON.stringify({
        from: "Check Your Representative <onboarding@resend.dev>",
        to: ["mangeris4thepeople2026@gmail.com"], // Admin only for now
        reply_to: "reports@checkyourrepresentative.com",
        subject: "District " + district + " - " + rep.name + " - Daily Constituent Report",
        html,
      }),
    });
    const data = await r.json();
    return r.ok;
  } catch { return false; }
}

async function sendAdminEmail(html, count) {
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_KEY,
      },
      body: JSON.stringify({
        from: "Check Your Representative <onboarding@resend.dev>",
        to: ["mangeris4thepeople2026@gmail.com"],
        subject: "CYR Daily Report - " + count + " districts with data",
        html: "<h2>Daily run complete</h2><p>" + count + " district reports sent.</p>" + html,
      }),
    });
  } catch {}
}

function buildAdminSummary(results) {
  return results.map(r =>
    "<div style='margin:8px 0'><strong>" + r.district + "</strong> - " + r.rep + " - " + (r.sent ? "✓ sent" : "✗ failed") + "</div>"
  ).join("");
}

function buildEmail(district, rep, rows) {
  const totalVotes    = rows.reduce((s,r) => s + Number(r.total_votes), 0);
  const totalSupport  = rows.reduce((s,r) => s + Number(r.support_votes), 0);
  const totalOppose   = rows.reduce((s,r) => s + Number(r.oppose_votes), 0);
  const totalContacts = rows.reduce((s,r) => s + Number(r.contacted_rep), 0);
  const today = new Date().toLocaleDateString("en-US", { weekday:"long", year:"numeric", month:"long", day:"numeric" });

  const tableRows = rows.map(row => {
    const total = Number(row.total_votes) || 1;
    const supPct = Math.round(Number(row.support_votes)/total*100);
    const oppPct = Math.round(Number(row.oppose_votes)/total*100);
    const bill = (row.bill_id || "").replace(/-119$/,"").toUpperCase();
    return `<tr style="border-bottom:1px solid #e0d9c8;">
      <td style="padding:12px 16px;font-family:monospace;font-weight:700;color:#0A1A3F;">${bill}</td>
      <td style="padding:12px 16px;text-align:center;color:#1B5E20;font-weight:700;">${row.support_votes} <span style="color:#999;font-size:11px;">(${supPct}%)</span></td>
      <td style="padding:12px 16px;text-align:center;color:#B71C1C;font-weight:700;">${row.oppose_votes} <span style="color:#999;font-size:11px;">(${oppPct}%)</span></td>
      <td style="padding:12px 16px;text-align:center;color:#666;">${row.undecided_votes}</td>
      <td style="padding:12px 16px;text-align:center;font-weight:900;font-size:16px;">${row.total_votes}</td>
      <td style="padding:12px 16px;text-align:center;font-weight:700;color:#8B0000;">${row.contacted_rep}</td>
    </tr>`;
  }).join("");

  return `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
  <div style="max-width:700px;margin:0 auto;background:#fff;">
    <div style="background:#0A1A3F;padding:28px 32px;border-bottom:4px solid #C9A227;">
      <div style="color:#C9A227;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Check Your Representative - Daily Constituent Report</div>
      <div style="color:#fff;font-size:22px;font-weight:700;">District ${district} - ${today}</div>
      <div style="color:#cfd6e4;font-size:13px;margin-top:6px;">Representative: ${rep.name} (${rep.party}) · ${rep.phone}</div>
    </div>
    <div style="background:#8B0000;padding:24px 32px;">
      <table width="100%"><tr>
        <td style="text-align:center;padding:8px;"><div style="font-size:42px;font-weight:900;color:#fff;line-height:1;">${totalVotes}</div><div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;">Constituents Weighed In</div></td>
        <td style="text-align:center;padding:8px;border-left:1px solid rgba(255,255,255,0.2);"><div style="font-size:42px;font-weight:900;color:#4CAF50;line-height:1;">${totalSupport}</div><div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;">Support</div></td>
        <td style="text-align:center;padding:8px;border-left:1px solid rgba(255,255,255,0.2);"><div style="font-size:42px;font-weight:900;color:#ef5350;line-height:1;">${totalOppose}</div><div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;">Oppose</div></td>
        <td style="text-align:center;padding:8px;border-left:1px solid rgba(255,255,255,0.2);"><div style="font-size:42px;font-weight:900;color:#C9A227;line-height:1;">${totalContacts}</div><div style="font-size:10px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;">Contacted Office</div></td>
      </tr></table>
    </div>
    <div style="padding:24px 32px;background:#EFE7D2;border-bottom:1px solid #D8C9A0;">
      <p style="margin:0;font-size:15px;color:#1A1A1A;line-height:1.7;"><strong>Representative ${rep.name},</strong><br><br>
      Your constituents in District ${district} have recorded their positions on the bills below at <a href="https://checkyourrepresentative.com" style="color:#8B0000;">CheckYourRepresentative.com</a>. These numbers are real, verified, and growing. This report is sent daily.</p>
    </div>
    <div style="padding:24px 32px;">
      <table width="100%" style="border-collapse:collapse;font-size:13px;">
        <thead><tr style="background:#0A1A3F;color:#fff;">
          <th style="padding:12px 16px;text-align:left;font-size:10px;letter-spacing:1px;text-transform:uppercase;">Bill</th>
          <th style="padding:12px 16px;text-align:center;font-size:10px;color:#4CAF50;text-transform:uppercase;">Support</th>
          <th style="padding:12px 16px;text-align:center;font-size:10px;color:#ef5350;text-transform:uppercase;">Oppose</th>
          <th style="padding:12px 16px;text-align:center;font-size:10px;color:#ccc;text-transform:uppercase;">Undecided</th>
          <th style="padding:12px 16px;text-align:center;font-size:10px;text-transform:uppercase;">Total</th>
          <th style="padding:12px 16px;text-align:center;font-size:10px;color:#C9A227;text-transform:uppercase;">Contacted</th>
        </tr></thead>
        <tbody>${tableRows}</tbody>
      </table>
    </div>
    <div style="background:#0A1A3F;padding:20px 32px;text-align:center;">
      <div style="color:#C9A227;font-size:12px;font-weight:700;margin-bottom:8px;">CheckYourRepresentative.com - Paid for by We The People Inc.</div>
      <a href="${rep.contact_url}" style="color:#fff;font-size:12px;">Contact page: ${rep.contact_url}</a>
    </div>
  </div></body></html>`;
}
