// test-email.js — hardcoded key for launch verification
export default async function handler(req, res) {
  const KEY = "re_hNBNrFbn_KpAZnS1S5dgqaSkZ6VJE3vTz";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + KEY },
    body: JSON.stringify({
      from: "Check Your Representative <onboarding@resend.dev>",
      to: ["douglas.mangeris@gmail.com"],
      subject: "CYR is LIVE — Launch July 1 at 8AM",
      html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;background:#fff;">
        <div style="background:#0A1A3F;padding:28px;border-bottom:4px solid #C9A227;">
          <div style="color:#C9A227;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Check Your Representative</div>
          <div style="color:#fff;font-size:26px;font-weight:700;">Email System: ONLINE</div>
        </div>
        <div style="background:#8B0000;padding:32px;text-align:center;">
          <div style="font-size:64px;font-weight:900;color:#fff;line-height:1;">READY</div>
          <div style="font-size:14px;color:rgba(255,255,255,0.9);margin-top:12px;letter-spacing:3px;text-transform:uppercase;">Launch July 1, 2026 at 8:00 AM</div>
        </div>
        <div style="padding:32px;background:#EFE7D2;">
          <p style="font-size:16px;color:#1A1A1A;line-height:1.8;margin:0;">
            <strong>Doug,</strong><br><br>
            CheckYourRepresentative.com is ready to launch. The email system works.
            Every morning at 6AM, every rep with constituent votes gets an accountability report.
            437 representatives loaded. All 6 modules live. The numbers are going in their faces.<br><br>
            <strong>We The People Inc.</strong>
          </p>
        </div>
        <div style="padding:20px;background:#0A1A3F;text-align:center;">
          <div style="color:#C9A227;font-size:12px;font-weight:700;">CheckYourRepresentative.com — Paid for by We The People Inc.</div>
        </div>
      </div>`,
    }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(500).json({ error: data });
  return res.status(200).json({ ok: true, id: data.id, message: "Email sent to douglas.mangeris@gmail.com" });
}
