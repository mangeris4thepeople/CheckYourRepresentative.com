// =============================================================================
// KnowYourRep.jsx - the Know Your Rep section. Follows the same state-view
// pattern as NgosDirectory.jsx (this app has no router): a searchable, paged
// list, and a detail view for one representative sourced from the FEC.
//
// List: search by name, state, or district. Click a representative for their
// bio, per-cycle FEC financial totals, every FEC filing on record with a
// direct link to the PDF, and a bounded top-donor breakdown.
//
// October 2026 redesign: intro card, pill search, member rows with a party
// colored initial badge, and a detail page built from white Panel cards with
// a StatGrid of the latest cycle and proportional donor bars. Presentation
// only; every fetch and state transition is unchanged. No em dashes.
// =============================================================================
import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import { Panel, StatGrid, Loading, Empty as KitEmpty, ErrorBox } from "./ui/Kit.jsx";

const ReportCard = lazy(() => import("./ReportCard.jsx"));

const C = {
  navy: "#0E2A6B", blue: "#2563EB", red: "#E0313F", gold: "#F5B82E",
  ink: "#0F172A", muted: "#5B6578", line: "#E2E8F0", soft: "#F8FAFE", sky: "#E8F0FF",
};

const PARTY = {
  D: { label: "Democrat", color: C.blue, bg: "#E8F0FF" },
  R: { label: "Republican", color: C.red, bg: "#FDECEE" },
  I: { label: "Independent", color: C.muted, bg: "#EEF2F8" },
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
  const [errorDetail, setErrorDetail] = useState(null);

  const loadList = useCallback(async (newOffset, append) => {
    setPhase("loading");
    try {
      const p = new URLSearchParams({ limit: String(PAGE_SIZE), offset: String(newOffset) });
      if (search) p.set("q", search);
      const r = await fetch(`/api/representatives-list?${p}`);
      const d = await r.json().catch(() => null);
      // A real server error has no ready field at all, distinct from the
      // handler's own ready:false for a genuinely missing table. Treating
      // them the same hides real bugs behind a generic message.
      if (!r.ok || !d || d.ready === undefined) {
        console.error("Representatives list fetch failed", { status: r.status, d });
        setErrorDetail(d?.detail || d?.error || `HTTP ${r.status}`);
        setPhase("error");
        return;
      }
      if (!d.ready) { setPhase("notready"); return; }
      setReps(prev => append ? [...prev, ...(d.reps || [])] : (d.reps || []));
      setOffset(d.offset ?? newOffset);
      setHasMore(!!d.hasMore);
      setMatchedVia(d.matchedVia || null);
      setResolvedDistrict(d.resolvedDistrict || null);
      setPhase("ready");
    } catch (err) {
      console.error("Representatives list fetch threw", err);
      setErrorDetail(String(err.message || err));
      setPhase("error");
    }
  }, [search]);

  useEffect(() => { loadList(0, false); }, [search, loadList]);

  function runSearch() { setSearch(searchInput.trim()); }

  if (selected) {
    return <RepDetail district={selected} onBack={() => setSelected(null)} />;
  }

  return (
    <div style={{ color: C.ink, maxWidth: 1000, margin: "0 auto", minWidth: 0 }}>
      <Intro eyebrow="Know your rep · House" title="Every member of the House">
        A full financial and biographical profile on every member of the House, sourced
        straight from the FEC and Congress.gov: bio, per-cycle campaign finance totals,
        every FEC filing with a direct link to the original document, and top donors.
      </Intro>

      <SearchBar value={searchInput} onChange={setSearchInput} onSubmit={runSearch}
        placeholder="Search by name, state, or district (e.g. Garcia, CA, TX-12)" label="Search representatives" />

      {matchedVia === "address" && reps.length > 0 && (
        <div className="cyr-chip" style={{ marginBottom: 12, background: "#FFF6DD", color: "#8A5A00", fontWeight: 600, padding: "6px 12px" }}>
          Matched by address: <strong style={{ color: C.navy }}>{resolvedDistrict}</strong>
        </div>
      )}

      {phase === "loading" && reps.length === 0 && <Loading rows={6} height={64} />}
      {phase === "error" && (
        <ErrorBox onRetry={() => loadList(0, false)}>
          Could not load representatives.
          {errorDetail && <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, marginTop: 4, fontFamily: "var(--cyr-mono)" }}>{errorDetail}</span>}
        </ErrorBox>
      )}
      {phase === "notready" && (
        <div className="cyr-card"><KitEmpty icon="🏛️" title="Not loaded yet">The representatives database is not loaded yet.</KitEmpty></div>
      )}
      {phase === "ready" && reps.length === 0 && (
        <div className="cyr-card"><KitEmpty icon="🔎" title="No matches">No representatives match that search.</KitEmpty></div>
      )}

      {reps.length > 0 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 300px), 1fr))", gap: 10 }}>
          {reps.map((r, i) => {
            const party = PARTY[r.party] || { label: r.party || "", color: C.muted, bg: "#EEF2F8" };
            return (
              <button key={r.district} onClick={() => setSelected(r.district)} className={`cyr-row${i < 12 ? " cyr-rise" : ""}`}
                style={{ width: "100%", textAlign: "left", cursor: "pointer", fontFamily: "inherit", minHeight: 64,
                         animationDelay: `${Math.min(i, 12) * 25}ms` }}>
                <Avatar name={r.name} party={party} />
                <span style={{ flex: 1, minWidth: 0 }}>
                  <span style={{ display: "block", fontSize: 15, fontWeight: 700, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {r.name}
                  </span>
                  <span style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginTop: 3 }}>
                    <span className="cyr-chip" style={{ fontSize: 11, padding: "2px 8px", fontFamily: "var(--cyr-mono)" }}>{r.district}</span>
                    <span style={{ fontSize: 12.5, color: party.color, fontWeight: 600 }}>{party.label}</span>
                    {!r.fec_candidate_id && <span style={{ fontSize: 12, color: C.muted }}>not yet matched to FEC</span>}
                  </span>
                </span>
                <span aria-hidden style={{ color: "#94A3B8", fontSize: 20, flexShrink: 0 }}>›</span>
              </button>
            );
          })}
        </div>
      )}

      {phase === "ready" && hasMore && (
        <button onClick={() => loadList(offset + PAGE_SIZE, true)} className="cyr-btn cyr-btn-ghost"
          style={{ width: "100%", justifyContent: "center", marginTop: 14, padding: 14 }}>
          Load more representatives
        </button>
      )}
      {phase === "loading" && reps.length > 0 && (
        <div style={{ textAlign: "center", color: C.muted, fontSize: 13, padding: 10 }}>Loading more...</div>
      )}
    </div>
  );
}

function RepDetail({ district, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);
  const [errorDetail, setErrorDetail] = useState(null);
  const [showCard, setShowCard] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/representative-detail?district=${encodeURIComponent(district)}`)
      .then(async r => ({ ok: r.ok, status: r.status, d: await r.json().catch(() => null) }))
      .then(({ ok, status, d }) => {
        if (cancelled) return;
        if (!ok || !d || d.ready === undefined) {
          console.error("Representative detail fetch failed", { status, d });
          setErrorDetail(d?.detail || d?.error || `HTTP ${status}`);
          setPhase("error");
          return;
        }
        if (!d.ready) { setPhase("notready"); return; }
        setData(d);
        setPhase("ready");
      })
      .catch(err => {
        if (cancelled) return;
        console.error("Representative detail fetch threw", err);
        setErrorDetail(String(err.message || err));
        setPhase("error");
      });
    return () => { cancelled = true; };
  }, [district]);

  const back = <BackButton onClick={onBack}>All representatives</BackButton>;
  const wrap = { color: C.ink, maxWidth: 920, margin: "0 auto", minWidth: 0 };

  if (phase === "loading") return <div style={wrap}>{back}<Loading rows={4} height={90} /></div>;
  if (phase === "error") return (
    <div style={wrap}>
      {back}
      <ErrorBox>
        Could not load this representative.
        {errorDetail && <span style={{ display: "block", fontSize: 11.5, fontWeight: 500, marginTop: 4, fontFamily: "var(--cyr-mono)" }}>{errorDetail}</span>}
      </ErrorBox>
    </div>
  );
  if (phase === "notready") return <div style={wrap}>{back}<div className="cyr-card"><KitEmpty icon="🏛️">The representatives database is not loaded yet.</KitEmpty></div></div>;

  const { rep, matched, totals, filings, topDonors } = data;
  const party = PARTY[rep.party] || { label: rep.party || "", color: C.muted, bg: "#EEF2F8" };
  const latest = totals[0];

  return (
    <div style={wrap}>
      {back}

      <MemberHeader name={rep.name} party={party} eyebrow={`U.S. House · ${rep.district}`}
        meta={[rep.district, party.label, rep.state]} phone={rep.phone}
        website={rep.website} contactUrl={rep.contact_url}
        showCard={showCard} onToggleCard={() => setShowCard(s => !s)} />

      {showCard && (
        <div style={{ marginBottom: 18 }}>
          <Suspense fallback={<Loading rows={3} height={80} />}>
            <ReportCard district={district} onClose={() => setShowCard(false)} />
          </Suspense>
        </div>
      )}

      {!matched && (
        <div className="cyr-card" style={{ marginBottom: 18 }}>
          <KitEmpty icon="🧾" title="Not matched to the FEC yet">
            This representative has not been matched to an FEC record yet. Financial data will appear once the sync catches up.
          </KitEmpty>
        </div>
      )}

      {matched && (
        <>
          {latest && (
            <StatGrid min={150} items={[
              { value: usd(latest.receipts), label: "Raised", hint: `Cycle ${latest.cycle}`, tone: "navy" },
              { value: usd(latest.disbursements), label: "Spent", hint: `Cycle ${latest.cycle}`, tone: "red" },
              { value: usd(latest.individual_contributions), label: "From individuals", hint: `Cycle ${latest.cycle}`, tone: "blue" },
              { value: usd(latest.pac_contributions), label: "From PACs", hint: `Cycle ${latest.cycle}`, tone: "gold" },
            ]} />
          )}
          <FinanceSections totals={totals} filings={filings} topDonors={topDonors} />
        </>
      )}
    </div>
  );
}

// ---- presentational helpers (SenateDirectory.jsx mirrors these) ----

function FinanceSections({ totals, filings, topDonors }) {
  const bySize = topDonors.filter(d => d.bucket_type === "size");
  const byState = topDonors.filter(d => d.bucket_type !== "size");
  return (
    <>
      <Panel eyebrow="FEC totals" title="Per-cycle financial totals" pad={0}>
        {totals.length === 0
          ? <SmallEmpty>No FEC financial totals on record yet.</SmallEmpty>
          : totals.map((t, i) => (
            <ListRow key={i} last={i === totals.length - 1}
              left={`Cycle ${t.cycle}`}
              sub={`${usd(t.individual_contributions)} individual · ${usd(t.pac_contributions)} PAC · ${usd(t.party_contributions)} party`}
              right={<><span className="cyr-num" style={{ fontSize: 16, color: C.navy }}>{usd(t.receipts)}</span><span style={{ display: "block", fontSize: 12, color: C.muted, fontWeight: 500 }}>raised, {usd(t.disbursements)} spent</span></>} />
          ))}
      </Panel>

      <Panel eyebrow="Primary documents" title={`FEC filings (${filings.length})`} pad={0}>
        {filings.length === 0
          ? <SmallEmpty>No FEC filings on record yet.</SmallEmpty>
          : filings.map((f, i) => (
            <ListRow key={i} last={i === filings.length - 1}
              left={titleCase(f.report_type) || "FEC filing"}
              sub={`${f.coverage_start || "?"} to ${f.coverage_end || "?"} · filed ${f.filed_date || "?"}`}
              right={<>
                <span style={{ display: "block", fontSize: 14, fontWeight: 700, color: C.ink }}>{usd(f.total_receipts)} raised</span>
                {f.pdf_url && (
                  <a href={f.pdf_url} target="_blank" rel="noopener noreferrer"
                    style={{ display: "inline-block", marginTop: 4, fontSize: 12.5, fontWeight: 700, color: C.blue, textDecoration: "none" }}>
                    View filing (PDF) →
                  </a>
                )}
              </>} />
          ))}
      </Panel>

      <Panel eyebrow="Where it came from" title="Top donors" pad={topDonors.length ? 18 : 0}>
        {topDonors.length === 0
          ? <SmallEmpty>No donor breakdown on record yet.</SmallEmpty>
          : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(min(100%, 280px), 1fr))", gap: 22 }}>
              {bySize.length > 0 && <DonorBars title="By contribution size" rows={bySize} />}
              {byState.length > 0 && <DonorBars title="By donor state" rows={byState} />}
            </div>
          )}
      </Panel>
    </>
  );
}

function DonorBars({ title, rows }) {
  const max = Math.max(...rows.map(r => Number(r.total_amount) || 0), 1);
  return (
    <div style={{ minWidth: 0 }}>
      <div style={{ fontSize: 13.5, fontWeight: 800, color: C.navy, marginBottom: 10 }}>{title}</div>
      <div style={{ display: "grid", gap: 10 }}>
        {rows.map((d, i) => (
          <div key={i} style={{ minWidth: 0 }}>
            <div style={{ display: "flex", justifyContent: "space-between", gap: 10, fontSize: 13.5 }}>
              <span style={{ fontWeight: 600, minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{d.bucket_label}</span>
              <span style={{ fontWeight: 700, whiteSpace: "nowrap", fontVariantNumeric: "tabular-nums" }}>{usd(d.total_amount)}</span>
            </div>
            <div style={{ height: 8, borderRadius: 99, background: "#EEF2F8", marginTop: 5, overflow: "hidden" }}>
              <div style={{ height: "100%", width: `${Math.max(2, (Number(d.total_amount) || 0) / max * 100)}%`, borderRadius: 99,
                            background: "linear-gradient(90deg,#2563EB,#0E2A6B)" }} />
            </div>
            <div style={{ fontSize: 11.5, color: C.muted, marginTop: 3 }}>
              Cycle {d.cycle}{d.donor_count ? ` · ${d.donor_count} contributions` : ""}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MemberHeader({ name, party, eyebrow, meta, phone, website, contactUrl, showCard, onToggleCard }) {
  return (
    <div className="cyr-card cyr-rise" style={{ padding: 0, overflow: "hidden", marginBottom: 18 }}>
      <div style={{ height: 6, background: `linear-gradient(90deg, ${party.color}, ${C.navy})` }} />
      <div style={{ padding: "20px 22px", display: "flex", gap: 16, alignItems: "flex-start", flexWrap: "wrap",
                    background: "linear-gradient(120deg,#FFFFFF 40%,#EEF4FF)" }}>
        <Avatar name={name} party={party} size={56} />
        <div style={{ flex: "1 1 240px", minWidth: 0 }}>
          <div className="cyr-eyebrow" style={{ fontSize: 11 }}>{eyebrow}</div>
          <h2 className="cyr-h2" style={{ fontSize: "clamp(24px, 3.4vw, 32px)", marginTop: 4 }}>{name}</h2>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 10 }}>
            {meta.filter(Boolean).map((m, i) => (
              <span key={i} className="cyr-chip" style={i === 1 ? { background: party.bg, color: party.color } : undefined}>{m}</span>
            ))}
            {phone && <span className="cyr-chip" style={{ background: "#F1F5FB", color: C.ink }}>📞 {phone}</span>}
          </div>
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center" }}>
          <button onClick={onToggleCard} className="cyr-btn cyr-btn-primary">
            📋 {showCard ? "Hide report card" : "Report card"}
          </button>
          {website && <a href={website} target="_blank" rel="noopener noreferrer" className="cyr-btn cyr-btn-ghost">Official site →</a>}
          {contactUrl && <a href={contactUrl} target="_blank" rel="noopener noreferrer" className="cyr-btn cyr-btn-ghost">Contact page →</a>}
        </div>
      </div>
    </div>
  );
}

function Avatar({ name, party, size = 42 }) {
  const parts = String(name || "").split(/\s+/).filter(Boolean);
  const initials = ((parts[0] || "")[0] || "") + ((parts[parts.length - 1] || "")[0] || "");
  return (
    <span aria-hidden style={{ width: size, height: size, borderRadius: size * 0.32, flexShrink: 0, display: "grid", placeItems: "center",
                               background: party.bg, color: party.color, fontWeight: 800, fontSize: size * 0.36,
                               border: `1px solid ${party.color}33` }}>
      {initials.toUpperCase()}
    </span>
  );
}

function Intro({ eyebrow, title, children }) {
  return (
    <div className="cyr-card cyr-rise" style={{ padding: "18px 20px", marginBottom: 16, background: "linear-gradient(120deg,#FFFFFF 45%,#EEF4FF)" }}>
      <div className="cyr-eyebrow" style={{ fontSize: 11 }}>{eyebrow}</div>
      <h2 className="cyr-h2" style={{ fontSize: "clamp(21px, 2.6vw, 26px)", marginTop: 6 }}>{title}</h2>
      <div style={{ fontSize: 14.5, color: "#475569", lineHeight: 1.6, marginTop: 6, maxWidth: 720 }}>{children}</div>
    </div>
  );
}

function SearchBar({ value, onChange, onSubmit, placeholder, label }) {
  return (
    <div className="cyr-card" style={{ padding: 10, borderRadius: 999, marginBottom: 16, display: "flex", gap: 8, alignItems: "center" }}>
      <div style={{ position: "relative", flex: 1, minWidth: 0 }}>
        <span aria-hidden style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 15, opacity: .55 }}>🔎</span>
        <input value={value} onChange={e => onChange(e.target.value)}
          onKeyDown={e => e.key === "Enter" && onSubmit()}
          placeholder={placeholder} aria-label={label}
          style={{ width: "100%", fontSize: 15, padding: "11px 14px 11px 40px", border: `1px solid ${C.line}`, borderRadius: 999 }} />
      </div>
      <button onClick={onSubmit} className="cyr-btn cyr-btn-primary" style={{ minHeight: 42 }}>Search</button>
    </div>
  );
}

function BackButton({ onClick, children }) {
  return (
    <button onClick={onClick} className="cyr-btn cyr-btn-ghost" style={{ marginBottom: 16, minHeight: 40 }}>
      <span aria-hidden>←</span> {children}
    </button>
  );
}

function ListRow({ left, sub, right, last }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 14, padding: "14px 20px", flexWrap: "wrap",
                  borderBottom: last ? "none" : "1px solid #EEF2F8" }}>
      <div style={{ flex: "1 1 200px", minWidth: 0 }}>
        <div style={{ fontSize: 14.5, fontWeight: 700, color: C.navy }}>{left}</div>
        {sub ? <div style={{ fontSize: 12.5, color: C.muted, lineHeight: 1.5, marginTop: 2 }}>{sub}</div> : null}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: C.ink, flexShrink: 0, textAlign: "right", marginLeft: "auto" }}>{right}</div>
    </div>
  );
}

function SmallEmpty({ children }) {
  return <div style={{ padding: "16px 20px", fontSize: 14, color: C.muted }}>{children}</div>;
}

// "JULY QUARTERLY" -> "July quarterly" so FEC report names read in sentence case.
function titleCase(s) {
  if (!s) return s;
  const t = String(s).toLowerCase();
  return t.charAt(0).toUpperCase() + t.slice(1);
}
