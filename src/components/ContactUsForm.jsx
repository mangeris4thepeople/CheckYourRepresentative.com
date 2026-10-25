// =============================================================================
// ContactUsForm.jsx - general "Contact us" form shown in every footer.
//
// This is site feedback and questions, separate from Contact Your
// Representative, which messages Congress. Submissions post to /api/contact-us,
// which emails info@checkyourrepresentative.com.
//
// Styled for the dark navy footers: translucent glass fields with light text,
// a soft blue focus ring, and the site's gradient pill button.
// House style: no em dashes.
// =============================================================================
import React, { useState } from "react";

const sans = "var(--cyr-sans)";

export default function ContactUsForm() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // honeypot
  const [status, setStatus] = useState("idle"); // idle | sending | sent | error
  const [error, setError] = useState("");

  async function submit(e) {
    if (e && e.preventDefault) e.preventDefault();
    if (!name.trim() || !email.includes("@") || !comment.trim()) {
      setError("Please enter your name, a valid email, and a comment.");
      setStatus("error");
      return;
    }
    setStatus("sending");
    setError("");
    try {
      const r = await fetch("/api/contact-us", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, comment, website }),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok || d.ok === false) {
        setError(d.error || "Could not send your message. Please try again.");
        setStatus("error");
        return;
      }
      setStatus("sent");
      setName(""); setEmail(""); setComment("");
    } catch {
      setError("Could not reach the server. Please try again.");
      setStatus("error");
    }
  }

  const inputStyle = {
    width: "100%", boxSizing: "border-box", fontFamily: sans, fontSize: 15,
    padding: "12px 14px", borderRadius: 12, border: "1px solid rgba(255,255,255,0.22)",
    background: "rgba(255,255,255,0.08)", color: "#fff", minHeight: 44, display: "block",
  };
  const labelStyle = { display: "block", fontSize: 12.5, fontWeight: 600, color: "#C9D6F0", marginBottom: 6 };

  return (
    <form onSubmit={submit} className="cyr-contact" style={{ maxWidth: 440, width: "100%", textAlign: "left", fontFamily: sans }}>
      <style>{`
        .cyr-contact input::placeholder, .cyr-contact textarea::placeholder { color: rgba(220,228,245,.55); }
        .cyr-contact input:focus, .cyr-contact textarea:focus { background: rgba(255,255,255,.12) !important; border-color: #7FA6FF !important; box-shadow: 0 0 0 4px rgba(96,140,255,.25) !important; }
      `}</style>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
        <span aria-hidden style={{ width: 32, height: 32, borderRadius: 10, display: "grid", placeItems: "center", fontSize: 15,
                                   background: "rgba(255,255,255,.12)", border: "1px solid rgba(255,255,255,.2)" }}>✉️</span>
        <div style={{ fontFamily: "var(--cyr-display)", fontSize: 19, fontWeight: 750, color: "#fff" }}>Contact us</div>
      </div>
      <div style={{ fontSize: 13, color: "#AFC0E2", lineHeight: 1.55, marginBottom: 14 }}>
        Questions or feedback about the site. To message Congress, use Contact Your Representative.
      </div>

      {status === "sent" ? (
        <div role="status" style={{ fontSize: 14.5, fontWeight: 600, color: "#fff", lineHeight: 1.6, padding: "14px 16px", borderRadius: 14,
                                   background: "rgba(22,163,74,.18)", border: "1px solid rgba(74,222,128,.4)" }}>
          Thanks, we got your message. We will get back to you at the email you provided.
          <div>
            <button type="button" onClick={() => setStatus("idle")} className="cyr-btn cyr-btn-light" style={{ marginTop: 12 }}>
              Send another
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* honeypot, hidden from real users */}
          <input type="text" value={website} onChange={e => setWebsite(e.target.value)}
            tabIndex={-1} autoComplete="off" aria-hidden="true"
            style={{ position: "absolute", left: "-9999px", width: 1, height: 1, opacity: 0 }} />

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 170px), 1fr))", gap: 10, marginBottom: 10 }}>
            <label style={{ minWidth: 0 }}>
              <span style={labelStyle}>Name</span>
              <input type="text" placeholder="Your name" value={name} autoComplete="name"
                onChange={e => setName(e.target.value)} style={inputStyle} />
            </label>
            <label style={{ minWidth: 0 }}>
              <span style={labelStyle}>Email</span>
              <input type="email" placeholder="you@example.com" value={email} autoComplete="email"
                onChange={e => setEmail(e.target.value)} style={inputStyle} />
            </label>
          </div>
          <label style={{ display: "block", marginBottom: 12 }}>
            <span style={labelStyle}>Comment</span>
            <textarea placeholder="What is on your mind?" value={comment} rows={3}
              onChange={e => setComment(e.target.value)}
              style={{ ...inputStyle, resize: "vertical", minHeight: 92, lineHeight: 1.5 }} />
          </label>

          {error && (
            <div role="alert" style={{ fontSize: 13, fontWeight: 600, color: "#FFD1D6", marginBottom: 12, padding: "9px 12px", borderRadius: 10,
                                      background: "rgba(224,49,63,.18)", border: "1px solid rgba(244,63,94,.4)" }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={status === "sending"} className="cyr-btn cyr-btn-primary"
            style={{ minHeight: 44, padding: "11px 22px", opacity: status === "sending" ? 0.7 : 1 }}>
            {status === "sending" ? "Sending..." : <>Send message <span aria-hidden>→</span></>}
          </button>
        </>
      )}
    </form>
  );
}
