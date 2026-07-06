// =============================================================================
// KnowYourRep.jsx - the Know Your Rep section. Follows the same state-view
// pattern as NgosDirectory.jsx (this app has no router): a searchable, paged
// list, and a detail view for one representative sourced from the FEC.
//
// List: search by name, state, or district. Click a representative for their
// bio, per-cycle FEC financial totals, every FEC filing on record with a
// direct link to the PDF, and a bounded top-donor breakdown.
// =============================================================================
import React, { useState, useEffect, useCallback } from "react";

const C = {
  navy: "#0A1A3F", gold: "#C9A227", crimson: "#8B0000", parchment: "#FBF7EC",
  ink: "#1A1A1A", muted: "#5C5347", line: "#D8C9A0", green: "#1B5E20", red: "#B71C1C",
};
const serif = "Georgia, 'Times New Roman', serif";

const PARTY = {
  D: { label: "Democrat", color: C.navy },
  R: { label: "Republican", color: C.crimson },
  I: { label: "Independent", color: C.muted },
};

const usd = (n) => n == null ? "$0" : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(Number(n) || 0);

const PAGE_SIZE = 20;

export default function KnowYourRep() {
  const [phase, setPhase] = useState("loading"); // loading | ready | notready | error
  const [reps, setReps] = useState([]);
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [selected, setSelected] = useState(null); // district
  const [matchedVia, setMatchedVia] = useState(null);
  const [resolvedDistrict, setResolvedDistrict] = useState(null);

  const loadList = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (search) p.set("q", search);
      const r = await fetch(`/api/representatives-list?${p}`);
      const d = await r.json();
      if (!d.ready) { setPhase("notready"); return; }
      setReps(prev => append ? [...prev, ...(d.reps || [])] : (d.reps || []));
      setOffset(d.offset ?? newOffset);
      setHasMore(!!d.hasMore);
      setMatchedVia(d.matchedVia || null);
      setResolvedDistrict(d.resolvedDistrict || null);
      setPhase("ready");
    } catch {
      setPhase("error");
    }
  }, [search]);

  useEffect(() => { loadList(0, false); }, [search, loadList]);

  function runSearch() { setSearch(searchInput.trim()); }

  if (selected) {
    return <RepDetail district={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 1000, margin: "0 auto" }}>
      <div style={{ background: C.navy, color: "#fff", padding: "22px 24px", borderRadius: 8,
                    border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: 3, color: C.gold, textTransform: "uppercase", marginBottom: 8 }}>
          Know Your Rep
        </div>
        <div style={{ fontSize: 14, color: "#cfd6e4", lineHeight: 1.6 }}>
          A full financial and biographical profile on every member of the House, sourced
          straight from the FEC and Congress.gov: bio, per-cycle campaign finance totals,
          every FEC filing with a direct link to the original document, and top donors.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && runSearch()}
          placeholder="Search by name, state, or district (e.g. Garcia, CA, TX-12)"
          style={{ flex: 1, fontFamily: serif, fontSize: 14, padding: "10px 12px",
                   border: `1px solid ${C.line}`, borderRadius: 5 }} />
        <button onClick={runSearch}
          style={{ fontFamily: serif, fontWeight: 700, fontSize: 13, padding: "10px 18px",
                   background: C.crimson, color: "#fff", border: "none", borderRadius: 5, cursor: "pointer" }}>
          Search
        </button>
      </div>

      {matchedVia === "address" && reps.length > 0 && (
        <div style={{ background: C.parchment, border: `1px solid ${C.gold}`, borderRadius: 6,
                      padding: "8px 14px", marginBottom: 12, fontSize: 12.5, color: C.muted }}>
          Matched by address: <strong style={{ color: C.navy }}>{resolvedDistrict}</strong>
        </div>
      )}

      {phase === "loading" && reps.length === 0 && <Center>Loading representatives...</Center>}
      {phase === "error" && (
        <Center color={C.crimson}>Could not load representatives. <Link onClick={() => loadList(0, false)}>Try again</Link></Center>
      )}
      {phase === "notready" && (
        <Center>The representatives database is not loaded yet.</Center>
      )}
      {phase === "ready" && reps.length === 0 && <Center>No representatives match that search.</Center>}

      {reps.length > 0 && (
        <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>
          {reps.map((r, i) => {
            const party = PARTY[r.party] || { label: r.party || "", color: C.muted };
            return (
              <button key={r.district} onClick={() => setSelected(r.district)}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", background: "transparent",
                         border: "none", borderBottom: i < reps.length - 1 ? `1px solid #ece7d5` : "none",
                         padding: "12px 16px", display: "flex", alignItems: "center", gap: 14, fontFamily: serif }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                  </div>
                  <div style={{ fontSize: 11.5, color: C.muted }}>
                    {r.district} · {party.label}
                    {!r.fec_candidate_id && " · not yet matched to FEC"}
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: party.color, flexShrink: 0 }}>
                  {r.state}
                </div>
              </button>
            );
          })}
        </div>
      )}

      {phase === "ready" && hasMore && (
        <button onClick={() => loadList(offset + PAGE_SIZE, true)}
          style={{ width: "100%", padding: 12, fontFamily: serif, fontWeight: 700, fontSize: 13,
                   background: C.navy, color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", marginTop: 10 }}>
          Load More Representatives
        </button>
      )}
      {phase === "loading" && reps.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 12, padding: 8 }}>Loading more...</div>
      )}
    </div>
  );
}

function RepDetail({ district, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/representative-detail?district=${encodeURIComponent(district)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.ready) { setPhase("notready"); return; }
        setData(d);
        setPhase("ready");
      })
      .catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, [district]);

  const back = (
    <button onClick={onBack}
      style={{ fontFamily: serif, fontSize: 13, fontWeight: 700, color: C.navy, background: "none",
               border: `1px solid ${C.line}`, borderRadius: 6, padding: "6px 14px", cursor: "pointer", marginBottom: 16 }}>
      ← All representatives
    </button>
  );

  if (phase === "loading") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>Loading representative...</Center></div>;
  if (phase === "error") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center color={C.crimson}>Could not load this representative.</Center></div>;
  if (phase === "notready") return <div style={{ fontFamily: serif, maxWidth: 900, margin: "0 auto" }}>{back}<Center>The representatives database is not loaded yet.</Center></div>;

  const { rep, matched, totals, filings, topDonors } = data;
  const party = PARTY[rep.party] || { label: rep.party || "", color: C.muted };

  return (
    <div style={{ fontFamily: serif, color: C.ink, maxWidth: 900, margin: "0 auto" }}>
      {back}

      <div style={{ background: C.navy, color: "#fff", padding: "20px 24px", borderRadius: 8, border: `3px solid ${C.gold}`, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 900 }}>{rep.name}</div>
        <div style={{ fontSize: 12.5, color: "#cfd6e4", marginTop: 4 }}>
          {rep.district} · {party.label} · {rep.state}
        </div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginTop: 10, fontSize: 12.5 }}>
          {rep.phone && <span style={{ color: "#cfd6e4" }}>📞 {rep.phone}</span>}
          {rep.website && (
            <a href={rep.website} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, fontWeight: 700 }}>Official site →</a>
          )}
          {rep.contact_url && (
            <a href={rep.contact_url} target="_blank" rel="noopener noreferrer" style={{ color: C.gold, fontWeight: 700 }}>Contact page →</a>
          )}
        </div>
      </div>

      {!matched && (
        <Center>This representative has not been matched to an FEC record yet. Financial data will appear once the sync catches up.</Center>
      )}

      {matched && (
        <>
          <Section title="Per-cycle financial totals">
            {totals.length === 0
              ? <Empty>No FEC financial totals on record yet.</Empty>
              : totals.map((t, i) => (
                <Row key={i} left={`Cycle ${t.cycle}`}
                  sub={`${usd(t.individual_contributions)} individual · ${usd(t.pac_contributions)} PAC · ${usd(t.party_contributions)} party`}
                  right={`${usd(t.receipts)} raised, ${usd(t.disbursements)} spent`} />
              ))}
          </Section>

          <Section title={`FEC filings (${filings.length})`}>
            {filings.length === 0
              ? <Empty>No FEC filings on record yet.</Empty>
              : filings.map((f, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f0ead8" }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>{f.report_type || "FEC filing"}</div>
                    <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>
                      {f.coverage_start || "?"} to {f.coverage_end || "?"} · filed {f.filed_date || "?"}
                    </div>
                  </div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", flexShrink: 0, textAlign: "right" }}>
                    {usd(f.total_receipts)} raised
                    {f.pdf_url && (
                      <div>
                        <a href={f.pdf_url} target="_blank" rel="noopener noreferrer" style={{ fontSize: 11.5, color: C.crimson, fontWeight: 700 }}>
                          View filing (PDF) →
                        </a>
                      </div>
                    )}
                  </div>
                </div>
              ))}
          </Section>

          <Section title="Top donors">
            {topDonors.length === 0
              ? <Empty>No donor breakdown on record yet.</Empty>
              : topDonors.map((d, i) => (
                <Row key={i} left={d.bucket_label}
                  sub={d.bucket_type === "size" ? "By contribution size, cycle " + d.cycle : "By donor state, cycle " + d.cycle}
                  right={`${usd(d.total_amount)}${d.donor_count ? ` · ${d.donor_count} contributions` : ""}`} />
              ))}
          </Section>
        </>
      )}
    </div>
  );
}

// ---- small presentational helpers (mirrors NgosDirectory.jsx) ----
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, letterSpacing: 1, textTransform: "uppercase", marginBottom: 8 }}>{title}</div>
      <div style={{ background: "#fff", border: `1px solid ${C.line}`, borderRadius: 8, overflow: "hidden" }}>{children}</div>
    </div>
  );
}
function Row({ left, sub, right }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderBottom: "1px solid #f0ead8" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 700, color: C.navy }}>{left}</div>
        {sub ? <div style={{ fontSize: 12, color: C.muted, lineHeight: 1.5 }}>{sub}</div> : null}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", flexShrink: 0 }}>{right}</div>
    </div>
  );
}
function Empty({ children }) {
  return <div style={{ padding: "14px", fontSize: 13, color: C.muted }}>{children}</div>;
}
function Center({ children, color }) {
  return <div style={{ textAlign: "center", padding: 40, color: color || C.muted, fontSize: 14.5, fontFamily: serif }}>{children}</div>;
}
function Link({ onClick, children }) {
  return <button onClick={onClick} style={{ background: "none", border: "none", color: C.crimson, fontFamily: serif, fontWeight: 700, cursor: "pointer", textDecoration: "underline" }}>{children}</button>;
}
