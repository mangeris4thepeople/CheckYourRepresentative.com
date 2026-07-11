// test-email.js
export default async function handler(req, res) {
  const KEY = "re_hNBNrFbn_KpAZnS1S5dgqaSkZ6VJE3vTz";
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + KEY },
    body: JSON.stringify({
      from: "Check Your Representative <onboarding@resend.dev>",
      to: ["mangeris4thepeople2026@gmail.com"],
      subject: "CYR Email System - LIVE",
      html: "<h1 style='color:#8B0000;font-family:Georgia'>CYR Email System Works</h1><p style='font-family:Georgia;font-size:16px'>Doug - email confirmed. The daily rep accountability reports will send. Launch is ready.</p><p style='font-family:Georgia'> -  CheckYourRepresentative.com</p>",
    }),
  });
  const data = await r.json();
  if (!r.ok) return res.status(500).json({ error: data });
  return res.status(200).json({ ok: true, id: data.id });
}
