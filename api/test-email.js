// /api/test-email.js
export default async function handler(req, res) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: "RESEND_API_KEY not set" });

  try {
    const r = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": "Bearer " + RESEND_KEY,
      },
      body: JSON.stringify({
        from: "Check Your Representative <reports@checkyourrepresentative.com>",
        to: ["douglas.mangeris@gmail.com"],
        subject: "CYR Test Email — Launch Day Ready",
        html: `<!DOCTYPE html><html><body style="margin:0;padding:0;background:#f5f0e8;font-family:Georgia,serif;">
<div style="max-width:600px;margin:0 auto;background:#fff;">
  <div style="background:#0A1A3F;padding:28px 32px;border-bottom:4px solid #C9A227;">
    <div style="color:#C9A227;font-size:11px;font-weight:700;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Check Your Representative</div>
    <div style="color:#fff;font-size:24px;font-weight:700;">Email System: Online</div>
  </div>
  <div style="background:#8B0000;padding:24px 32px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;">READY</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:8px;letter-spacing:2px;text-transform:uppercase;">Launch July 1, 2026 at 8:00 AM</div>
  </div>
  <div style="padding:32px;background:#EFE7D2;">
    <p style="margin:0;font-size:16px;color:#1A1A1A;line-height:1.7;">
      <strong>Doug,</strong><br><br>
      The CYR email system is live. This was sent from <strong>reports@checkyourrepresentative.com</strong>.<br><br>
      Every morning at 6AM ET, every representative with constituent votes in their district gets this report. They will see the numbers. We The People have spoken.
    </p>
  </div>
  <div style="padding:20px 32px;background:#0A1A3F;text-align:center;">
    <div style="color:#C9A227;font-size:12px;font-weight:700;">CheckYourRepresentative.com — Paid for by We The People Inc.</div>
  </div>
</div></body></html>`,
      }),
    });
    const data = await r.json();
    if (!r.ok) return res.status(500).json({ error: data });
    return res.status(200).json({ ok: true, id: data.id, to: "douglas.mangeris@gmail.com" });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}
