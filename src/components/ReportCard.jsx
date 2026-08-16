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
// =============================================================================
import React, { useState, useEffect } from "react";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  parchmentEdge: "#F0E6CE", ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0",
  green: "#1B5E20", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";
const mono = "'Courier New', monospace";

const PARTY = {
  D: { label: "Democrat", color: C.navy }, Democrat: { label: "Democrat", color: C.navy },
  R: { label: "Republican", color: C.crimson }, Republican: { label: "Republican", color: C.crimson },
  I: { label: "Independent", color: C.muted }, Independent: { label: "Independent", color: C.muted },
};

const usd = (n) => n == null ? "—" : new Intl.NumberFormat("en-US",
  { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);
const num = (n) => n == null ? "—" : new Intl.NumberFormat("en-US").format(Number(n) || 0);

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

  if (phase === "loading") return <Panel><Center>Pulling the public record…</Center></Panel>;
  if (phase === "notready") return <Panel><Center>The report card data hasn't been synced yet. Check back soon.</Center></Panel>;
  if (phase === "error") return <Panel><Center>Couldn't load this report card. <button onClick={() => window.location.reload()} style={linkBtn}>Retry</button></Center></Panel>;

  const { member, tenure, money, donors, record, districtVotes, sources } = card;
  const party = PARTY[member.party] || { label: member.party || "", color: C.muted };
  const seat = member.chamber === "senate" ? `U.S. Senator, ${member.state}` : `U.S. Representative, ${member.district}`;
  const latest = money.totals?.[0] || null;
  const careerReceipts = (money.totals || []).reduce((s, t) => s + (Number(t.receipts) || 0), 0);
  const att = record.attendance;
  const sinceYear = tenure.since ? new Date(tenure.since).getFullYear() : null;

  return (
    <Panel>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 16, borderBottom: `3px double ${C.line}`, paddingBottom: 16 }}>
        {member.photo_url && (
          <img src={member.photo_url} alt={member.name}
            style={{ width: 76, height: 94, objectFit: "cover", borderRadius: 4, border: `2px solid ${C.line}` }} />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: 11, letterSpacing: 2, color: C.muted }}>REPRESENTATIVE REPORT CARD</div>
          <div style={{ fontFamily: serif, fontSize: 24, fontWeight: 700, color: C.navy }}>{member.name}</div>
          <div style={{ fontFamily: serif, fontSize: 14, color: party.color, fontWeight: 700 }}>
            {party.label} · {seat}
          </div>
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button onClick={share} style={shareBtn}>{copied ? "✓ Link copied" : "Share this card"}</button>
          {onClose && <button onClick={onClose} style={closeBtn}>Close</button>}
        </div>
      </div>

      {/* 1. Tenure */}
      <Section n="1" title="TENURE">
        <Big>
          {sinceYear ? `In office since ${sinceYear}.` : "Tenure record unavailable."}
          {tenure.years != null && <span style={{ color: C.crimson }}> {tenure.years} years.</span>}
        </Big>
        {tenure.currentTermEnds && (
          <Fine>Current term ends {new Date(tenure.currentTermEnds).getFullYear()}. <Src href={sources.tenure}>Bioguide record</Src></Fine>
        )}
      </Section>

      {/* 2. The Money */}
      <Section n="2" title="THE MONEY">
        {latest ? (
          <>
            <Big>{usd(latest.receipts)} <span style={{ fontSize: 15, color: C.muted }}>raised this cycle ({latest.cycle}).</span></Big>
            <Row label="Individual contributions" value={usd(latest.individual_contributions)} />
            <Row label="PAC contributions" value={usd(latest.pac_contributions)} />
            <Row label="Cash on hand" value={usd(latest.cash_on_hand_end)} />
            {money.totals.length > 1 && (
              <Fine>Across the {money.totals.length} most recent cycles on file: {usd(careerReceipts)} raised. <Src href={sources.money}>FEC data</Src></Fine>
            )}
          </>
        ) : (
          <Fine>FEC finance records not yet matched for this member. <Src href={sources.money}>Search the FEC</Src></Fine>
        )}
      </Section>

      {/* 3. Who Provided It */}
      <Section n="3" title="WHO PROVIDED IT">
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
      <Section n="4" title="WHY ARE YOU STILL HERE?" accent>
        {att && (
          <>
            <Big>
              Showed up for <span style={{ color: att.pctCast >= 95 ? C.green : att.pctCast >= 85 ? C.gold : C.crimson }}>
                {att.pctCast}%</span> of roll-call votes.
            </Big>
            <Row label={`Votes held (Congress ${att.congress})`} value={num(att.votesTotal)} />
            <Row label="Votes cast" value={num(att.votesCast)} />
            <Row label="Votes missed" value={num(att.votesMissed)} />
          </>
        )}
        {record.sponsoredTotal != null && (
          <Row label="Bills sponsored (career)" value={num(record.sponsoredTotal)} />
        )}
        {record.committees.length > 0 && (
          <Fine style={{ marginTop: 8 }}>
            Serves on: {record.committees.map(c => c.committee_name + (c.role ? ` (${c.role})` : "")).filter((v, i, a) => a.indexOf(v) === i).slice(0, 4).join("; ")}
          </Fine>
        )}
        {record.recentBills.length > 0 && (
          <div style={{ marginTop: 10 }}>
            <div style={{ fontFamily: mono, fontSize: 10, letterSpacing: 1.5, color: C.muted, marginBottom: 4 }}>MOST RECENT SPONSORED BILLS</div>
            {record.recentBills.slice(0, 3).map((b, i) => (
              <div key={i} style={{ fontFamily: serif, fontSize: 13, color: C.ink, marginBottom: 3 }}>
                · <a href={b.source_url} target="_blank" rel="noreferrer" style={{ color: C.navy }}>{b.title}</a>
              </div>
            ))}
          </div>
        )}
        {!att && record.sponsoredTotal == null && !record.recentBills.length && (
          <Fine>Voting and legislative records not yet synced for this member. <Src href={sources.record}>Congress.gov record</Src></Fine>
        )}
        <Fine style={{ marginTop: 10 }}>
          The full record: <Src href={sources.record}>Congress.gov</Src>
        </Fine>
      </Section>

      {/* Footer: constituent engagement */}
      <div style={{ marginTop: 18, padding: "14px 16px", background: C.parchmentEdge, borderRadius: 4, border: `1px solid ${C.line}` }}>
        <div style={{ fontFamily: serif, fontSize: 14, color: C.ink }}>
          {districtVotes?.positions
            ? <>Constituents here have cast <b>{num(districtVotes.positions)}</b> positions on <b>{num(districtVotes.bills)}</b> bills on this site. They're watching.</>
            : <>No constituent positions recorded here yet - be the first. Vote on the bills in front of Congress right now.</>}
        </div>
      </div>

      <div style={{ marginTop: 12, fontFamily: mono, fontSize: 10, color: C.muted, textAlign: "center", letterSpacing: 1 }}>
        EVERY NUMBER ABOVE IS A PUBLIC RECORD · CHECKYOURREPRESENTATIVE.COM
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
function Panel({ children }) {
  return (
    <div style={{ maxWidth: 680, margin: "0 auto", background: C.parchment, border: `1px solid ${C.line}`,
                  borderRadius: 6, padding: "22px 26px", boxShadow: "0 2px 8px rgba(10,26,63,0.08)" }}>
      {children}
    </div>
  );
}
function Center({ children }) {
  return <div style={{ fontFamily: serif, fontSize: 15, color: C.muted, textAlign: "center", padding: "40px 0" }}>{children}</div>;
}
function Section({ n, title, accent, children }) {
  return (
    <div style={{ marginTop: 18 }}>
      <div style={{ fontFamily: mono, fontSize: 12, letterSpacing: 2, fontWeight: 700,
                    color: accent ? C.crimson : C.navy, borderBottom: `1px solid ${C.line}`, paddingBottom: 4, marginBottom: 8 }}>
        {n}. {title}
      </div>
      {children}
    </div>
  );
}
function Big({ children }) {
  return <div style={{ fontFamily: serif, fontSize: 19, fontWeight: 700, color: C.ink, marginBottom: 6 }}>{children}</div>;
}
function Row({ label, value }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", fontFamily: serif, fontSize: 13.5,
                  color: C.ink, padding: "3px 0", borderBottom: `1px dotted ${C.parchmentEdge}` }}>
      <span style={{ color: C.muted }}>{label}</span>
      <span style={{ fontWeight: 700 }}>{value}</span>
    </div>
  );
}
function Fine({ children, style }) {
  return <div style={{ fontFamily: serif, fontSize: 12, color: C.muted, marginTop: 4, ...style }}>{children}</div>;
}
function Src({ href, children }) {
  return <a href={href} target="_blank" rel="noreferrer" style={{ color: C.navy, fontWeight: 700 }}>{children} ↗</a>;
}
const shareBtn = { fontFamily: serif, fontSize: 12, fontWeight: 700, color: "#fff", background: C.navy,
  border: `1px solid ${C.navy}`, borderRadius: 4, padding: "7px 12px", cursor: "pointer", whiteSpace: "nowrap" };
const closeBtn = { fontFamily: serif, fontSize: 12, color: C.muted, background: "transparent",
  border: `1px solid ${C.line}`, borderRadius: 4, padding: "6px 12px", cursor: "pointer" };
const linkBtn = { fontFamily: serif, fontSize: 13, color: C.navy, background: "none", border: "none",
  textDecoration: "underline", cursor: "pointer" };
