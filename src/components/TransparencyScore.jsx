import React from "react";

/**
 * TransparencyScore
 * Shows what % of an org's disclosed contributions/grants revenue can be traced
 * to a dollar-level public source (federal awards, FARA, FEC, Schedule I grants),
 * versus the portion that is legally aggregate-only (individual/501c4 donors).
 *
 * Adapted to the site's inline theme (this project does not use Tailwind).
 * October 2026 redesign: white card, big tabular percentage, tier chip and a
 * rounded meter. Presentation only.
 *
 * Props:
 *   pctTransparent: number | null   0 to 100, from org_funding_transparency.pct_transparent
 *   disclosedAmount: number
 *   undisclosedAmount: number
 *   fiscalYear: number
 */
const C = {
  navy: "#0E2A6B", muted: "#5B6578", line: "#E2E8F0", ink: "#0F172A",
  green: "#16A34A", amber: "#B7791F", red: "#E0313F", track: "#EEF2F8",
};

export default function TransparencyScore({
  pctTransparent,
  disclosedAmount,
  undisclosedAmount,
  fiscalYear,
}) {
  const formatUSD = (n) =>
    new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      maximumFractionDigits: 0,
    }).format(n || 0);

  if (pctTransparent === null || pctTransparent === undefined) {
    return (
      <div className="cyr-card" style={{ padding: 18, fontSize: 14, color: C.muted }}>
        No revenue filing on record for FY{fiscalYear}.
      </div>
    );
  }

  const tier = pctTransparent >= 75 ? "high" : pctTransparent >= 40 ? "medium" : "low";
  const tierStyles = {
    high:   { bar: C.green, bg: "#E8F7EE", label: "Mostly traceable" },
    medium: { bar: C.amber, bg: "#FFF6DD", label: "Partially traceable" },
    low:    { bar: C.red,   bg: "#FDECEE", label: "Largely untraceable" },
  }[tier];

  return (
    <div className="cyr-card" style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 12, flexWrap: "wrap", marginBottom: 12 }}>
        <div style={{ minWidth: 0 }}>
          <div className="cyr-eyebrow" style={{ fontSize: 11 }}>Funding transparency, FY{fiscalYear}</div>
          <div style={{ display: "flex", alignItems: "baseline", gap: 8, marginTop: 6 }}>
            <span className="cyr-num" style={{ fontSize: 38, color: C.navy, lineHeight: 1 }}>{pctTransparent}%</span>
            <span style={{ fontSize: 14, fontWeight: 700, color: C.ink }}>traceable</span>
          </div>
        </div>
        <span className="cyr-chip" style={{ background: tierStyles.bg, color: tierStyles.bar }}>{tierStyles.label}</span>
      </div>

      <div style={{ height: 12, width: "100%", borderRadius: 999, background: C.track, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pctTransparent, 100)}%`, minWidth: pctTransparent > 0 ? 6 : 0, background: tierStyles.bar, borderRadius: 999 }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", gap: 10, flexWrap: "wrap", marginTop: 10, fontSize: 13, color: C.muted }}>
        <span><strong style={{ color: C.ink }}>{formatUSD(disclosedAmount)}</strong> traced</span>
        <span><strong style={{ color: C.ink }}>{formatUSD(undisclosedAmount)}</strong> not itemized</span>
      </div>

      <p style={{ marginTop: 14, marginBottom: 0, fontSize: 12.5, color: C.muted, lineHeight: 1.6 }}>
        This score reflects what federal law requires organizations to disclose at the
        dollar level, not organizational conduct. A lower score usually means the org
        relies on individual or 501(c)(4)-style donors, whose identities are not publicly
        itemized under current law, not that funds are being hidden improperly.
      </p>
    </div>
  );
}
