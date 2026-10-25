// =============================================================================
// ReportCard.jsx - the Representative Report Card.
//
// Four sections, every number a public fact with its source one tap away:
//   TENURE, THE MONEY, WHO PROVIDED IT, and "WHY ARE YOU STILL HERE?" -
//   the record (attendance, sponsored bills, committees) that answers it.
// No letter grades and no editorial scores: the headline asks the question,
// the public record gives the answer, the reader forms the judgment.
//
// Props:
//   bioguide - member bioguide id (preferred)
//   district - House district (e.g. "CO-04") when the caller has no bioguide
//   onClose  - optional callback to dismiss
// Deep link: /report-card/:bioguide renders this full-page (see App.jsx).
//
// October 2026 redesign: white card with a party colored top rule, Fraunces
// headings, numbered section badges, big tabular numbers, and an attendance
// meter. Presentation only; the fetch and every figure are unchanged.
// =============================================================================
import React, { useState, useEffect } from "react";

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E", goldInk: "#B7791F",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F8FAFE", green: "#16A34A",
};

const PARTY = {
  D: { label: "Democrat", color: C.blue, bg: "#E8F0FF" }, Democrat: { label: "Democrat", color: C.blue, bg: "#E8F0FF" },
  R: { label: "Republican", color: C.red, bg: "#FDECEE" }, Republican: { label: "Republican", color: C.red, bg: "#FDECEE" },
  I: { label: "Independent", color: C.muted, bg: "#EEF2F8" }, Independent: { label: "Independent", color: C.muted, bg: "#EEF2F8" },
};

const usd = (n) => n == null ? "n/a" : new Intl.NumberFormat("en-US",
  { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);
const num = (n) => n == null ? "n/a" : new Intl.NumberFormat("en-US").format(Number(n) || 0);

export default function ReportCard({ bioguide, district, onClose }) {
  const [phase, setPhase] = useState("loading"); // loading | ready | error | notready
  const [card, setCard] = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!bioguide && !district) { setPhase("error"); return; }
    let cancelled = false;
    setPhase("loading");
    const q = bioguide
      ? `bioguide=${encodeURIComponent(bioguide)}`
      : `district=${encodeURIComponent(district)}`;
    fetch(`/api/report-card?${q}`)
      .then(r => { if (!r.ok) throw new Error(`report-card ${r.status}`); return r.json(); })
      .then(d => {
        if (cancelled) return;
        if (!d.ready) { setPhase("notready"); return; }
        setCard(d);
        setPhase("ready");
      })
      .catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, [bioguide, district]);

  function share() {
    const id = card?.member?.bioguide_id || bioguide;
    const url = `${window.location.origin}/report-card/${id}`;
    try {
      if (navigator.share) { navigator.share({ title: "Representative Report Card", url }); return; }
      navigator.clipboard.writeText(url).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      });
    } catch {}
  }

  if (phase === "loading") return <Shell><Center>Pulling the public record…</Center></Shell>;
  if (phase === "notready") return <Shell><Center>The report card data hasn't been synced yet. Check back soon.</Center></Shell>;
  if (phase === "error") return <Shell><Center>Couldn't load this report card. <button onClick={() => window.location.reload()} className="cyr-btn cyr-btn-ghost" style={{ marginLeft: 8 }}>Retry</button></Center></Shell>;

  const { member, tenure, money, donors, record, districtVotes, sources } = card;
  const party = PARTY[member.party] || { label: member.party || "", color: C.muted, bg: "#EEF2F8" };
  const seat = member.chamber === "senate" ? `U.S. Senator, ${member.state}` : `U.S. Representative, ${member.district}`;
  const latest = money.totals?.[0] || null;
  const careerReceipts = (money.totals || []).reduce((s, t) => s + (Number(t.receipts) || 0), 0);
  const att = record.attendance;
  const sinceYear = tenure.since ? new Date(tenure.since).getFullYear() : null;
  const attColor = att ? (att.pctCast >= 95 ? C.green : att.pctCast >= 85 ? C.goldInk : C.red) : C.muted;

  return (
    <Shell accent={party.color}>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap", paddingBottom: 18, borderBottom: `1px solid ${C.line}` }}>
        {member.photo_url && (
          <img src={member.photo_url} alt={member.name}
            style={{ width: 72, height: 88, objectFit: "cover", borderRadius: 14, border: `1px solid ${C.line}`, boxShadow: "0 6px 16px rgba(14,42,107,.14)" }} />
        )}
        <div style={{ flex: "1 1 220px", minWidth: 0 }}>
          <div className="cyr-eyebrow" style={{ fontSize: 11 }}>Representative report card</div>
          <div className="cyr-h2" style={{ fontSize: "clamp(24px, 3.2vw, 30px)", marginTop: 4 }}>{member.name}</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
            <span className="cyr-chip" style={{ background: party.bg, color: party.color }}>{party.label}</span>
            <span className="cyr-chip">{seat}</span>
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button onClick={share} className="cyr-btn cyr-btn-primary">{copied ? "✓ Link copied" : "Share this card"}</button>
          {onClose && <button onClick={onClose} className="cyr-btn cyr-btn-ghost">Close</button>}
        </div>
      </div>

      {/* 1. Tenure */}
      <Section n="1" title="Tenure">
        <Big>
          {sinceYear ? `In office since ${sinceYear}.` : "Tenure record unavailable."}
          {tenure.years != null && <span style={{ color: C.red }}> {tenure.years} years.</span>}
        </Big>
        {tenure.currentTermEnds && (
          <Fine>Current term ends {new Date(tenure.currentTermEnds).getFullYear()}. <Src href={sources.tenure}>Bioguide record</Src></Fine>
        )}
      </Section>

      {/* 2. The Money */}
      <Section n="2" title="The money">
        {latest ? (
          <>
            <Big><span className="cyr-num" style={{ fontSize: 30, color: C.navy }}>{usd(latest.receipts)}</span> <span style={{ fontSize: 15, color: C.muted, fontWeight: 600 }}>raised this cycle ({latest.cycle}).</span></Big>
            <Tiles items={[
              ["Individual contributions", usd(latest.individual_contributions)],
              ["PAC contributions", usd(latest.pac_contributions)],
              ["Cash on hand", usd(latest.cash_on_hand_end)],
            ]} />
            {money.totals.length > 1 && (
              <Fine>Across the {money.totals.length} most recent cycles on file: {usd(careerReceipts)} raised. <Src href={sources.money}>FEC data</Src></Fine>
            )}
          </>
        ) : (
          <Fine>FEC finance records not yet matched for this member. <Src href={sources.money}>Search the FEC</Src></Fine>
        )}
      </Section>

      {/* 3. Who Provided It */}
      <Section n="3" title="Who provided it">
        {donors.length ? (
          <>
            {donors.filter(d => d.bucket_type === "size").slice(0, 4).map((d, i) => (
              <Row key={`s${i}`} label={`Donations of ${d.bucket_label}`}
                   value={`${usd(d.total_amount)}${d.donor_count ? ` (${num(d.donor_count)} donors)` : ""}`} />
            ))}
            {donors.filter(d => d.bucket_type === "state").slice(0, 4).map((d, i) => (
              <Row key={`t${i}`} label={`From ${d.bucket_label}`} value={usd(d.total_amount)} />
            ))}
            <Fine>FEC's own aggregates, {donors[0].cycle} cycle. <Src href={donors[0].source_url}>Receipts page</Src></Fine>
          </>
        ) : (
          <Fine>Donor aggregates not yet on file for this member. <Src href={sources.money}>Search the FEC</Src></Fine>
        )}
      </Section>

      {/* 4. Why Are You Still Here? */}
      <Section n="4" title="Why are you still here?" accent>
        {att && (
          <>
            <Big>
              Showed up for <span className="cyr-num" style={{ color: attColor }}>{att.pctCast}%</span> of roll-call votes.
            </Big>
            <div style={{ height: 10, borderRadius: 99, background: "#EEF2F8", overflow: "hidden", margin: "2px 0 12px" }}>
              <div style={{ height: "100%", width: `${Math.min(100, Number(att.pctCast) || 0)}%`, background: attColor, borderRadius: 99 }} />
            </div>
            <Tiles items={[
              [`Votes held (Congress ${att.congress})`, num(att.votesTotal)],
              ["Votes cast", num(att.votesCast)],
              ["Votes missed", num(att.votesMissed)],
            ]} />
          </>
        )}
        {record.sponsoredTotal != null && (
          <Row label="Bills sponsored (career)" value={num(record.sponsoredTotal)} />
        )}
        {record.committees.length > 0 && (
          <Fine style={{ marginTop: 10 }}>
            Serves on: {record.committees.map(c => c.committee_name + (c.role ? ` (${c.role})` : "")).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join("; ")}
          </Fine>
        )}
        {record.recentBills.length > 0 && (
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 12.5, fontWeight: 800, color: C.navy, marginBottom: 6 }}>Most recent sponsored bills</div>
            <div style={{ display: "grid", gap: 6 }}>
              {record.recentBills.slice(0, 3).map((b, i) => (
                <a key={i} href={b.source_url} target="_blank" rel="noreferrer" className="cyr-row"
                  style={{ padding: "9px 12px", fontSize: 13.5, fontWeight: 600, color: C.navy, textDecoration: "none" }}>
                  <span style={{ flex: 1, minWidth: 0 }}>{b.title}</span>
                  <span aria-hidden style={{ color: "#94A3B8" }}>↗</span>
                </a>
              ))}
            </div>
          </div>
        )}
        {!att && record.sponsoredTotal == null && !record.recentBills.length && (
          <Fine>Voting and legislative records not yet synced for this member. <Src href={sources.record}>Congress.gov record</Src></Fine>
        )}
        <Fine style={{ marginTop: 12 }}>
          The full record: <Src href={sources.record}>Congress.gov</Src>
        </Fine>
      </Section>

      {/* Footer: constituent engagement */}
      <div style={{ marginTop: 20, padding: "14px 16px", background: "#FFF6DD", borderRadius: 14, border: "1px solid #F5D27A" }}>
        <div style={{ fontSize: 14, color: C.ink, lineHeight: 1.55 }}>
          {districtVotes?.positions
            ? <>Constituents here have cast <b>{num(districtVotes.positions)}</b> positions on <b>{num(districtVotes.bills)}</b> bills on this site. They're watching.</>
            : <>No constituent positions recorded here yet. Be the first: vote on the bills in front of Congress right now.</>}
        </div>
      </div>

      <div style={{ marginTop: 14, fontSize: 12, color: C.muted, textAlign: "center" }}>
        Every number above is a public record · checkyourrepresentative.com
      </div>
    </Shell>
  );
}

// ---------------------------------------------------------------------------
function Shell({ children, accent }) {
  return (
    <div className="cyr-card cyr-rise" style={{ maxWidth: 720, margin: "0 auto", padding: 0, overflow: "hidden" }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${accent || C.blue}, ${C.navy})` }} />
      <div style={{ padding: "22px clamp(16px, 4vw, 28px) 24px" }}>{children}</div>
    </div>
  );
}
function Center({ children }) {
  return <div style={{ fontSize: 15, color: C.muted, textAlign: "center", padding: "36px 0" }}>{children}</div>;
}
function Section({ n, title, accent, children }) {
  const tone = accent ? C.red : C.navy;
  return (
    <div style={{ marginTop: 22 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span aria-hidden style={{ width: 28, height: 28, borderRadius: 9, display: "grid", placeItems: "center", flexShrink: 0,
                                   background: accent ? "#FDECEE" : "#E8F0FF", color: tone, fontWeight: 800, fontSize: 13.5 }}>{n}</span>
        <span className="cyr-h2" style={{ fontSize: 19, color: tone }}>{title}</span>
      </div>
      {children}
    </div>
  );
}
function Big({ children }) {
  return <div style={{ fontSize: 19, fontWeight: 700, color: C.ink, marginBottom: 8, lineHeight: 1.35 }}>{children}</div>;
}
function Tiles({ items }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 150px), 1fr))", gap: 8, margin: "4px 0 6px" }}>
      {items.map(([label, value], i) => (
        <div key={i} style={{ background: C.soft, border: `1px solid ${C.line}`, borderRadius: 12, padding: "10px 12px", minWidth: 0 }}>
          <div className="cyr-num" style={{ fontSize: 19, color: C.navy }}>{value}</div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{label}</div>
        </div>
      ))}
    </div>
  );
}
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 14,
                  color: C.ink, padding: "8px 0", borderBottom: "1px solid #EEF2F8" }}>
      <span style={{ color: C.muted, minWidth: 0 }}>{label}</span>
      <span style={{ fontWeight: 700, textAlign: "right", fontVariantNumeric: "tabular-nums", whiteSpace: "nowrap" }}>{value}</span>
    </div>
  );
}
function Fine({ children, style }) {
  return <div style={{ fontSize: 12.5, color: C.muted, marginTop: 6, lineHeight: 1.55, ...style }}>{children}</div>;
}
function Src({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: C.blue, fontWeight: 700, textDecoration: "none" }}>{children} ↗</a>;
}
