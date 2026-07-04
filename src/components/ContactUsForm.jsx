// =============================================================================
// ContactUsForm.jsx - general "Contact Us" form shown in every footer.
//
// This is site feedback and questions, separate from Contact Your
// Representative, which messages Congress. Submissions post to /api/contact-us,
// which emails info@checkyourrepresentative.com.
//
// Styled for the dark footer backgrounds (black on landing, navy in the tool).
// =============================================================================
import React, { useState } from "react";

const GOLD = "#C9A227";
const CRIMSON = "#8B0000";
const serif = "Georgia, 'Times New Roman', serif";

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
    width: "100%", boxSizing: "border-box", fontFamily: serif, fontSize: 14,
    padding: "9px 11px", borderRadius: 5, border: "1px solid rgba(255,255,255,0.25)",
    background: "#fff", color: "#1A1A1A", marginBottom: 8,
  };

  return (
    <form onSubmit={submit} style={{ maxWidth: 420, width: "100%", textAlign: "left" }}>
      <div style={{ fontFamily: serif, fontSize: 14, fontWeight: 700, color: GOLD, letterSpacing: 1, marginBottom: 10 }}>
        CONTACT US
      </div>

      {status === "sent" ? (
        <div style={{ fontFamily: serif, fontSize: 14, fontWeight: 700, color: "#fff", lineHeight: 1.6 }}>
          Thanks, we got your message. We will get back to you at the email you provided.
          <div>
            <button type="button" onClick={() => setStatus("idle")}
              style={{ marginTop: 10, fontFamily: serif, fontSize: 13, fontWeight: 700, color: GOLD,
                       background: "none", border: `1px solid ${GOLD}`, borderRadius: 5,
                       padding: "6px 12px", cursor: "pointer" }}>
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

          <input type="text" placeholder="Name" value={name}
            onChange={e => setName(e.target.value)} style={inputStyle} />
          <input type="email" placeholder="Email" value={email}
            onChange={e => setEmail(e.target.value)} style={inputStyle} />
          <textarea placeholder="Comment" value={comment} rows={3}
            onChange={e => setComment(e.target.value)}
            style={{ ...inputStyle, resize: "vertical" }} />

          {error && (
            <div style={{ fontFamily: serif, fontSize: 12.5, fontWeight: 700, color: "#ffb4a8", marginBottom: 8 }}>
              {error}
            </div>
          )}

          <button type="submit" disabled={status === "sending"}
            style={{ fontFamily: serif, fontSize: 14, fontWeight: 700, color: "#fff",
                     background: CRIMSON, border: "none", borderRadius: 5,
                     padding: "9px 20px", cursor: status === "sending" ? "default" : "pointer" }}>
            {status === "sending" ? "Sending..." : "Send Message"}
          </button>
        </>
      )}
    </form>
  );
}
