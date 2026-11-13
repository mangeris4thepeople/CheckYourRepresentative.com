// =============================================================================
// ConsentBanner.jsx - asks once whether Google Analytics may run. Shown only
// when GA is configured for this build and the visitor has not chosen yet.
// Vercel Web Analytics is cookieless and runs regardless, as the privacy
// policy describes. Copy lives here so the choice is stated next to its
// buttons. House style: no em dashes.
// =============================================================================
import React, { useState } from "react";
import { getAnalyticsConsent, setAnalyticsConsent, gaConfigured } from "../lib/ga.js";

export default function ConsentBanner() {
  const [open, setOpen] = useState(() => gaConfigured() && getAnalyticsConsent() === null);
  if (!open) return null;

  function choose(value) {
    setAnalyticsConsent(value);
    setOpen(false);
  }

  return (
    <div role="region" aria-label="Analytics choice"
      style={{ position: "fixed", left: 12, right: 12, bottom: 12, zIndex: 900, maxWidth: 560, margin: "0 auto",
               background: "#fff", border: "1px solid #DCE6F7", borderRadius: 16,
               boxShadow: "0 20px 40px rgba(11,27,68,.25)", padding: "16px 18px",
               fontSize: 14, lineHeight: 1.55, color: "#1F2937" }}>
      <div style={{ fontWeight: 800, color: "var(--cyr-navy)", marginBottom: 4 }}>Help us see which pages people use</div>
      <div>
        If you allow it, we use Google Analytics to count visits and see which pages people use.
        It sets cookies only if you say yes. Our privacy-focused Vercel counts run either way.
        The Privacy Policy explains both.
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, justifyContent: "flex-end", flexWrap: "wrap" }}>
        <button type="button" className="cyr-btn cyr-btn-ghost" onClick={() => choose("denied")}>No thanks</button>
        <button type="button" className="cyr-btn cyr-btn-primary" onClick={() => choose("granted")}>Allow analytics</button>
      </div>
    </div>
  );
}
