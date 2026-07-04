import React from "react";

/**
 * TransparencyScore
 * Shows what % of an org's disclosed contributions/grants revenue can be traced
 * to a dollar-level public source (federal awards, FARA, FEC, Schedule I grants),
 * versus the portion that is legally aggregate-only (individual/501c4 donors).
 *
 * Adapted to the site's inline theme (this project does not use Tailwind).
 *
 * Props:
 *   pctTransparent: number | null   0 to 100, from org_funding_transparency.pct_transparent
 *   disclosedAmount: number
 *   undisclosedAmount: number
 *   fiscalYear: number
 */
const C = {
  navy: "#0A1A3F", gold: "#C9A227", muted: "#5C5347", line: "#D8C9A0",
  ink: "#1A1A1A", parchment: "#FBF7EC",
  green: "#1B5E20", amber: "#B8860B", red: "#B71C1C", track: "#EDE6D0",
};
const serif = "Georgia, 'Times New Roman', serif";

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
      <div style={{ fontFamily: serif, border: `1px solid ${C.line}`, borderRadius: 8,
                    padding: 16, fontSize: 13.5, color: C.muted, background: "#fff" }}>
        No revenue filing on record for FY{fiscalYear}.
      </div>
    );
  }

  const tier = pctTransparent >= 75 ? "high" : pctTransparent >= 40 ? "medium" : "low";
  const tierStyles = {
    high:   { bar: C.green, label: "Mostly traceable" },
    medium: { bar: C.amber, label: "Partially traceable" },
    low:    { bar: C.red,   label: "Largely untraceable" },
  }[tier];

  return (
    <div style={{ fontFamily: serif, border: `1px solid ${C.line}`, borderRadius: 8,
                  padding: 16, background: "#fff" }}>
      <div style={{ display: "flex", alignItems: "baseline", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>
          Funding transparency, FY{fiscalYear}
        </span>
        <span style={{ fontSize: 14, fontWeight: 900, color: C.ink }}>
          {pctTransparent}% traceable
        </span>
      </div>

      <div style={{ height: 8, width: "100%", borderRadius: 999, background: C.track, overflow: "hidden" }}>
        <div style={{ height: "100%", width: `${Math.min(pctTransparent, 100)}%`, background: tierStyles.bar }} />
      </div>

      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 8, fontSize: 12, color: C.muted }}>
        <span>{tierStyles.label}</span>
        <span>
          {formatUSD(disclosedAmount)} traced / {formatUSD(undisclosedAmount)} not itemized
        </span>
      </div>

      <p style={{ marginTop: 12, marginBottom: 0, fontSize: 12, color: C.muted, lineHeight: 1.6 }}>
        This score reflects what federal law requires organizations to disclose at the
        dollar level, not organizational conduct. A lower score usually means the org
        relies on individual or 501(c)(4)-style donors, whose identities are not publicly
        itemized under current law, not that funds are being hidden improperly.
      </p>
    </div>
  );
}
