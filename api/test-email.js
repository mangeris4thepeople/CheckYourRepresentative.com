// rebuilt: 1782719296
// /api/test-email.js
export default async function handler(req, res) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY) return res.status(500).json({ error: "RESEND_API_KEY not set" });

  // Try custom domain first, fall back to resend.dev
  const attempts = [
    { from: "Check Your Representative <reports@checkyourrepresentative.com>", label: "custom_domain" },
    { from: "Check Your Representative <onboarding@resend.dev>", label: "resend_dev" },
  ];

  for (const attempt of attempts) {
    try {
      const r = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": "Bearer " + RESEND_KEY,
        },
        body: JSON.stringify({
          from: attempt.from,
          to: ["douglas.mangeris@gmail.com"],
          subject: "CYR Test — " + attempt.label + " — Launch Ready",
          html: `<div style="font-family:Georgia,serif;max-width:600px;margin:0 auto;">
  <div style="background:#0A1A3F;padding:28px;border-bottom:4px solid #C9A227;">
    <div style="color:#C9A227;font-size:11px;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px;">Check Your Representative</div>
    <div style="color:#fff;font-size:24px;font-weight:700;">Email System Online</div>
    <div style="color:#cfd6e4;font-size:12px;margin-top:6px;">Sent via: ${attempt.label}</div>
  </div>
  <div style="background:#8B0000;padding:24px;text-align:center;">
    <div style="font-size:48px;font-weight:900;color:#fff;">READY</div>
    <div style="font-size:13px;color:rgba(255,255,255,0.8);margin-top:8px;letter-spacing:2px;">LAUNCH JULY 1, 2026 AT 8:00 AM</div>
  </div>
  <div style="padding:32px;background:#EFE7D2;">
    <p style="font-size:16px;color:#1A1A1A;line-height:1.7;">
      <strong>Doug,</strong><br><br>
      CYR email is live. Every morning at 6AM ET, every representative with constituent votes gets this report in their inbox. They will see the numbers. We The People have spoken.<br><br>
      <strong>From:</strong> ${attempt.from}
    </p>
  </div>
  <div style="padding:20px;background:#0A1A3F;text-align:center;">
    <div style="color:#C9A227;font-size:12px;font-weight:700;">CheckYourRepresentative.com — Paid for by We The People Inc.</div>
  </div>
</div>`,
        }),
      });
      const data = await r.json();
      if (r.ok) {
        return res.status(200).json({ ok: true, from: attempt.label, id: data.id });
      }
      // Log the error and try next
      console.error("Attempt failed:", attempt.label, JSON.stringify(data));
    } catch (err) {
      console.error("Exception:", attempt.label, err.message);
    }
  }

  return res.status(500).json({ error: "All sending attempts failed — check Vercel logs" });
}
