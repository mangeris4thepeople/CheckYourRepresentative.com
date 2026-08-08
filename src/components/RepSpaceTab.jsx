// =============================================================================
// RepSpaceTab.jsx - RepSpace, the satirical 2006 social profile page for all
// 535 members of Congress. The joke is the frame; every fact inside it is a
// real public record with a link to its source.
//
// The retro skin below is intentional and self contained. Do not restyle it
// into the site's serif and parchment theme: the whole bit is that a member
// of Congress has a 2006 profile page, and the bit dies if it looks like the
// rest of the site.
//
// Content rules, enforced server side and respected here:
//   Wall posts are verbatim items from the official record, each with a
//     source link. Nothing is ever written in the member's voice.
//   The headline comes from buildHeadline on the server, which maps rule
//     keys to code templates. The disclaimer the API sends next to it is
//     always rendered. Do not remove it.
//
// Three ways in: browse the full roster dropdown, text search, or address
// lookup (US Census geocoder). Each profile is shareable at
// /know-your-rep/repspace/[bioguide_id], a rewrite of the SPA that this
// component reads on mount and writes as profiles open.
// =============================================================================
import React, { useState, useEffect, useMemo } from "react";

// The 2006 palette. Verdana and Arial on purpose.
const MS = {
  headerBlue: "#6699CC", darkBlue: "#003399", panelBlue: "#D5E2EE", border: "#7FA6C9",
  orange: "#FF9933", link: "#003399", bg: "#FFFFFF", tableHead: "#FFCC99",
  text: "#000000", gray: "#666666",
};
const sans = "Verdana, Arial, Helvetica, sans-serif";

const PROFILE_PATH = /^\/know-your-rep\/repspace\/([A-Z]\d{6})$/;

function pathBioguide() {
  try {
    const m = window.location.pathname.match(PROFILE_PATH);
    return m ? m[1] : null;
  } catch { return null; }
}

function writeProfilePath(bioguide) {
  try {
    window.history.replaceState(null, "",
      bioguide ? `/know-your-rep/repspace/${bioguide}` : "/?tab=followthemoney");
  } catch {}
}

export default function RepSpaceTab() {
  const [selected, setSelected] = useState(pathBioguide);

  function openProfile(bioguide) {
    setSelected(bioguide);
    writeProfilePath(bioguide);
  }

  return (
    <div style={{ fontFamily: sans, fontSize: 12, color: MS.text, maxWidth: 960, margin: "0 auto",
                  background: MS.bg, border: `1px solid ${MS.border}` }}>
      <Masthead />
      <ParodyNotice />
      {selected
        ? <Profile bioguide={selected} onBack={() => openProfile(null)} />
        : <Finder onOpen={openProfile} />}
    </div>
  );
}

function Masthead() {
  return (
    <div style={{ background: MS.headerBlue, padding: "8px 14px", display: "flex",
                  alignItems: "baseline", gap: 10, borderBottom: `1px solid ${MS.darkBlue}` }}>
      <span style={{ fontSize: 22, fontWeight: 700, color: "#fff", letterSpacing: -1 }}>
        repspace<span style={{ color: MS.orange }}>.</span>
      </span>
      <span style={{ fontSize: 11, color: "#E8F0F8" }}>a place for accountability</span>
      <span style={{ marginLeft: "auto", fontSize: 10, color: "#E8F0F8" }}>
        est. 2006, records current
      </span>
    </div>
  );
}

function ParodyNotice() {
  return (
    <div style={{ background: "#FFF7E0", borderBottom: `1px solid ${MS.border}`, padding: "6px 14px",
                  fontSize: 10.5, color: "#5c4a00", lineHeight: 1.5 }}>
      RepSpace is a parody presentation of real officeholders. The design is a joke; the data is not.
      Every number, committee, donor figure, and wall item below comes from official public records,
      each linked at its source. Nothing on these pages is written by or approved by any member of Congress.
    </div>
  );
}

// ---------------------------------------------------------------- finder ----

function Finder({ onOpen }) {
  const [members, setMembers] = useState([]);
  const [phase, setPhase] = useState("loading");
  const [mode, setMode] = useState("browse"); // browse | search | address
  const [query, setQuery] = useState("");
  const [address, setAddress] = useState("");
  const [addressResult, setAddressResult] = useState(null);
  const [addressBusy, setAddressBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/repspace/members")
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.ready) { setPhase("notready"); return; }
        setMembers(d.members || []);
        setPhase("ready");
      })
      .catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, []);

  const filtered = useMemo(() => {
    if (!query.trim()) return [];
    const q = query.trim().toLowerCase();
    return members.filter(m =>
      m.full_name.toLowerCase().includes(q) ||
      m.state.toLowerCase() === q ||
      (m.district || "").toLowerCase().includes(q)).slice(0, 30);
  }, [members, query]);

  async function lookupAddress() {
    if (address.trim().length < 8 || addressBusy) return;
    setAddressBusy(true);
    setAddressResult(null);
    try {
      const r = await fetch(`/api/repspace/address-lookup?address=${encodeURIComponent(address.trim())}`);
      setAddressResult(await r.json());
    } catch {
      setAddressResult({ error: "lookup_failed" });
    } finally {
      setAddressBusy(false);
    }
  }

  const modeBtn = (key, label) => (
    <button onClick={() => setMode(key)}
      style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, padding: "4px 12px", cursor: "pointer",
               border: `1px solid ${MS.border}`, borderBottom: mode === key ? "none" : `1px solid ${MS.border}`,
               background: mode === key ? MS.bg : MS.panelBlue, color: MS.darkBlue }}>
      {label}
    </button>
  );

  return (
    <div style={{ padding: 14 }}>
      <div style={{ background: MS.panelBlue, border: `1px solid ${MS.border}`, padding: 10, marginBottom: 12 }}>
        <b style={{ color: MS.darkBlue }}>Find a Member of Congress</b>
        <div style={{ fontSize: 10.5, color: MS.gray, marginTop: 2 }}>
          All 435 Representatives and 100 Senators have a page. They did not sign up. That is the point.
        </div>
      </div>

      <div style={{ display: "flex", gap: 2 }}>
        {modeBtn("browse", "Browse All")}
        {modeBtn("search", "Search")}
        {modeBtn("address", "Find By Address")}
      </div>

      <div style={{ border: `1px solid ${MS.border}`, marginTop: -1, padding: 12 }}>
        {phase === "loading" && <p>Loading the roster...</p>}
        {phase === "error" && <p style={{ color: "#900" }}>Could not load the roster. Refresh to retry.</p>}
        {phase === "notready" && (
          <p>The RepSpace roster has not been synced yet. It fills in automatically once the weekly sync runs.</p>
        )}

        {phase === "ready" && mode === "browse" && (
          <div>
            <label htmlFor="rs-browse" style={{ fontWeight: 700 }}>Pick a member: </label>
            <select id="rs-browse" defaultValue="" onChange={e => e.target.value && onOpen(e.target.value)}
              style={{ fontFamily: sans, fontSize: 12, maxWidth: "100%" }}>
              <option value="" disabled>All {members.length} members, by state...</option>
              {members.map(m => (
                <option key={m.bioguide_id} value={m.bioguide_id}>
                  {m.state} · {m.chamber === "senate" ? "Sen." : (m.district || "Rep.")} · {m.full_name} ({(m.party || "?")[0]})
                </option>
              ))}
            </select>
          </div>
        )}

        {phase === "ready" && mode === "search" && (
          <div>
            <input value={query} onChange={e => setQuery(e.target.value)}
              placeholder="Name, state code, or district (CO-04)"
              style={{ fontFamily: sans, fontSize: 12, padding: "4px 6px", width: 280, maxWidth: "100%",
                       border: `1px solid ${MS.border}` }} />
            <table style={{ borderCollapse: "collapse", marginTop: 10, width: "100%" }}>
              <tbody>
                {filtered.map(m => (
                  <tr key={m.bioguide_id} style={{ borderBottom: "1px solid #E0E8F0" }}>
                    <td style={{ padding: "4px 6px", fontSize: 12 }}>
                      <a href={`/know-your-rep/repspace/${m.bioguide_id}`}
                         onClick={e => { e.preventDefault(); onOpen(m.bioguide_id); }}
                         style={{ color: MS.link, fontWeight: 700 }}>
                        {m.full_name}
                      </a>
                      <span style={{ color: MS.gray }}> · {m.party || "?"} · {m.district || `${m.state} (Senate)`}</span>
                    </td>
                  </tr>
                ))}
                {query.trim() && filtered.length === 0 && (
                  <tr><td style={{ padding: 6, color: MS.gray }}>No member matches that.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {mode === "address" && (
          <div>
            <div style={{ fontSize: 11, marginBottom: 6 }}>
              Enter a US street address. It is sent to the Census Bureau's public geocoder to find your
              congressional district, never stored, and never cached.
            </div>
            <input value={address} onChange={e => setAddress(e.target.value)}
              onKeyDown={e => e.key === "Enter" && lookupAddress()}
              placeholder="100 N Wilcox St, Castle Rock, CO"
              style={{ fontFamily: sans, fontSize: 12, padding: "4px 6px", width: 300, maxWidth: "100%",
                       border: `1px solid ${MS.border}` }} />
            <button onClick={lookupAddress} disabled={addressBusy}
              style={{ fontFamily: sans, fontSize: 11, fontWeight: 700, marginLeft: 6, padding: "4px 10px",
                       cursor: "pointer", border: `1px solid ${MS.border}`, background: MS.panelBlue }}>
              {addressBusy ? "Looking..." : "Find My Delegation"}
            </button>

            {addressResult && (
              <div style={{ marginTop: 10, border: `1px solid ${MS.border}`, padding: 8 }}>
                {addressResult.found ? (
                  <div>
                    <div style={{ fontSize: 11, color: MS.gray }}>
                      Matched: {addressResult.matchedAddress} · District {addressResult.district}
                    </div>
                    {[addressResult.representative, ...(addressResult.senators || [])]
                      .filter(Boolean).map(m => (
                        <div key={m.bioguide_id} style={{ marginTop: 4 }}>
                          <a href={`/know-your-rep/repspace/${m.bioguide_id}`}
                             onClick={e => { e.preventDefault(); onOpen(m.bioguide_id); }}
                             style={{ color: MS.link, fontWeight: 700 }}>
                            {m.full_name}
                          </a>
                          <span style={{ color: MS.gray }}>
                            {" "}· {m.chamber === "senate" ? "Senator" : `Representative, ${m.district}`}
                          </span>
                        </div>
                      ))}
                    {!addressResult.representative && (
                      <div style={{ color: MS.gray, marginTop: 4 }}>
                        No House member on file for {addressResult.district} yet; the roster sync may not have run.
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ color: "#900" }}>
                    Could not match that address{addressResult.reason ? ` (${addressResult.reason})` : ""}. Try
                    adding city and state.
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// --------------------------------------------------------------- profile ----

function Profile({ bioguide, onBack }) {
  const [phase, setPhase] = useState("loading");
  const [data, setData] = useState(null);

  useEffect(() => {
    let cancelled = false;
    setPhase("loading");
    fetch(`/api/repspace/profile?bioguide=${encodeURIComponent(bioguide)}`)
      .then(r => r.json())
      .then(d => {
        if (cancelled) return;
        if (!d.ready || !d.member) { setPhase(d.ready === false ? "notready" : "error"); return; }
        setData(d);
        setPhase("ready");
      })
      .catch(() => { if (!cancelled) setPhase("error"); });
    return () => { cancelled = true; };
  }, [bioguide]);

  const back = (
    <a href="/?tab=followthemoney" onClick={e => { e.preventDefault(); onBack(); }}
       style={{ color: MS.link, fontSize: 11, fontWeight: 700 }}>
      « Back to search
    </a>
  );

  if (phase !== "ready") {
    return (
      <div style={{ padding: 14 }}>
        {back}
        <p style={{ marginTop: 10 }}>
          {phase === "loading" && "Loading profile..."}
          {phase === "notready" && "The RepSpace database has not been synced yet."}
          {phase === "error" && "Could not load this profile."}
        </p>
      </div>
    );
  }

  const { member: m, stats, committees, donors, wall, headline, disclaimer } = data;
  const first = m.first_name || m.full_name.split(" ")[0];
  const title = m.chamber === "senate" ? "Senator" : "Representative";
  const seat = m.chamber === "senate" ? `${m.state} (Senate)` : (m.district || m.state);

  // Top level committees only for the Top 8 grid; subcommittees listed below it.
  const topCommittees = committees.filter(c => !c.subcommittee);
  const topDonors = donors.slice(0, 8);

  return (
    <div style={{ padding: 14 }}>
      {back}

      <table style={{ width: "100%", borderCollapse: "collapse", marginTop: 8 }}>
        <tbody>
          <tr>
            {/* left column */}
            <td style={{ width: "38%", verticalAlign: "top", paddingRight: 12 }}>
              <div style={{ fontSize: 16, fontWeight: 700 }}>{m.full_name}</div>

              <div style={{ fontSize: 11.5, margin: "4px 0", color: MS.darkBlue, fontWeight: 700 }}>
                "{headline.text}"
              </div>
              <div style={{ fontSize: 9.5, color: MS.gray, lineHeight: 1.4, marginBottom: 8 }}>
                {disclaimer}
              </div>

              <img src={m.photo_url} alt={`Official portrait of ${m.full_name}`}
                onError={e => { e.target.style.display = "none"; }}
                style={{ width: 170, border: `1px solid ${MS.border}`, display: "block" }} />
              <div style={{ fontSize: 10, color: MS.gray, margin: "3px 0 10px" }}>
                {title} · {seat} · {m.party || "Party unknown"}
              </div>

              <PanelTable title={`${first}: General Info`} rows={[
                ["Status", m.active ? "In office" : "No longer in office"],
                ["Here for", "Casting your votes for you"],
                ["Member since", m.first_term_start ? String(m.first_term_start).slice(0, 4) : "on record"],
                ["Current term ends", m.term_end ? String(m.term_end).slice(0, 10) : "on record"],
                ["Last recorded vote", stats && stats.last_vote_date ? String(stats.last_vote_date).slice(0, 10) : "not yet counted"],
              ]} />

              <div style={{ background: MS.panelBlue, border: `1px solid ${MS.border}`, marginTop: 10 }}>
                <div style={{ background: MS.headerBlue, color: "#fff", fontWeight: 700, fontSize: 11, padding: "3px 8px" }}>
                  Contacting {m.full_name}
                </div>
                <div style={{ padding: 8, fontSize: 11, lineHeight: 1.8 }}>
                  {m.phone && <div>☎ {m.phone}</div>}
                  {m.website && <div><a href={m.website} target="_blank" rel="noopener noreferrer" style={{ color: MS.link }}>Official website</a></div>}
                  {m.contact_form && <div><a href={m.contact_form} target="_blank" rel="noopener noreferrer" style={{ color: MS.link }}>Official contact form</a></div>}
                  <div><a href={`https://bioguide.congress.gov/search/bio/${m.bioguide_id}`} target="_blank" rel="noopener noreferrer" style={{ color: MS.link }}>Congressional Bioguide entry</a></div>
                </div>
              </div>

              {stats && stats.votes_total > 0 && (
                <PanelTable title={`${first}'s Voting Stats (this session)`} rows={[
                  ["Roll calls held", String(stats.votes_total)],
                  ["Votes cast", String(stats.votes_cast)],
                  ["Missed", String(stats.votes_missed)],
                  ["Voted Yes / No / Present", `${stats.yes_votes} / ${stats.no_votes} / ${stats.present_votes}`],
                ]} note="Counted from the official roll call record, House via Congress.gov, Senate via senate.gov." />
              )}
            </td>

            {/* right column */}
            <td style={{ verticalAlign: "top" }}>
              <div style={{ background: "#F8E8D8", border: `1px solid ${MS.orange}`, padding: 8,
                            fontSize: 12, fontWeight: 700, marginBottom: 10 }}>
                {m.full_name} works for you. That is not a slogan, it is the job description.
              </div>

              <SectionHead>{first}'s Committees (the Top 8)</SectionHead>
              {topCommittees.length === 0 ? (
                <Empty>No committee assignments on file yet.</Empty>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
                  <tbody>
                    {chunk(topCommittees.slice(0, 8), 2).map((row, i) => (
                      <tr key={i}>
                        {row.map((c, j) => (
                          <td key={j} style={{ width: "50%", border: "1px solid #E0C8A8", background: "#FDF6EC",
                                               padding: 6, fontSize: 11 }}>
                            <b>{c.committee_name}</b>
                            {c.role ? <div style={{ color: MS.gray }}>{c.role}</div> : null}
                            {Number.isFinite(c.rank) ? <div style={{ color: MS.gray }}>Seniority rank {c.rank}</div> : null}
                          </td>
                        ))}
                        {row.length === 1 && <td style={{ width: "50%" }} />}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              {committees.some(c => c.subcommittee) && (
                <div style={{ fontSize: 10, color: MS.gray, marginBottom: 10 }}>
                  Subcommittees: {committees.filter(c => c.subcommittee).map(c => c.subcommittee).join(" · ")}
                </div>
              )}

              <SectionHead>Top Donor Money (FEC aggregate buckets)</SectionHead>
              {topDonors.length === 0 ? (
                <Empty>No FEC donor data on file yet for this member.</Empty>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 4 }}>
                  <thead>
                    <tr style={{ background: MS.tableHead, fontSize: 10.5 }}>
                      <th style={cell}>Cycle</th><th style={cell}>Bucket</th>
                      <th style={cell}>Total</th><th style={cell}>Receipts</th>
                    </tr>
                  </thead>
                  <tbody>
                    {topDonors.map((d, i) => (
                      <tr key={i} style={{ fontSize: 11 }}>
                        <td style={cell}>{d.cycle}</td>
                        <td style={cell}>{d.bucket_type === "state" ? `From ${d.bucket_label}` : `Gifts of ${d.bucket_label}`}</td>
                        <td style={cell}>${Number(d.total_amount).toLocaleString()}</td>
                        <td style={cell}>
                          <a href={d.source_url} target="_blank" rel="noopener noreferrer" style={{ color: MS.link }}>
                            View on FEC.gov
                          </a>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
              <div style={{ fontSize: 10, color: MS.gray, marginBottom: 10 }}>
                These are the FEC's own pre-aggregated contribution buckets by gift size and donor state,
                not named individuals. Every row links to the receipts it summarizes.
              </div>

              <SectionHead>{first}'s Wall (the official record)</SectionHead>
              {wall.length === 0 ? (
                <Empty>Nothing on the wall yet; the record crawl fills this in over time.</Empty>
              ) : (
                wall.map((w, i) => (
                  <div key={i} style={{ border: "1px solid #E0E8F0", padding: 6, marginBottom: 4, fontSize: 11 }}>
                    <span style={{ color: MS.gray }}>
                      {w.posted_at ? String(w.posted_at).slice(0, 10) : "undated"} ·
                    </span>{" "}
                    <b>{w.title}</b>
                    {w.body && <div style={{ marginTop: 2 }}>{w.body}</div>}
                    <div>
                      <a href={w.source_url} target="_blank" rel="noopener noreferrer"
                         style={{ color: MS.link, fontSize: 10.5 }}>
                        View the official record »
                      </a>
                    </div>
                  </div>
                ))
              )}
              <div style={{ fontSize: 10, color: MS.gray, marginTop: 4 }}>
                Wall items are verbatim from the Congressional record. RepSpace never writes posts
                for a member, and never will.
              </div>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

const cell = { border: "1px solid #E0C8A8", padding: "3px 6px", textAlign: "left" };

function chunk(arr, n) {
  const out = [];
  for (let i = 0; i < arr.length; i += n) out.push(arr.slice(i, i + n));
  return out;
}

function SectionHead({ children }) {
  return (
    <div style={{ background: MS.orange, color: "#fff", fontWeight: 700, fontSize: 11,
                  padding: "3px 8px", marginBottom: 6 }}>
      {children}
    </div>
  );
}

function PanelTable({ title, rows, note }) {
  return (
    <div style={{ background: MS.panelBlue, border: `1px solid ${MS.border}`, marginTop: 10 }}>
      <div style={{ background: MS.headerBlue, color: "#fff", fontWeight: 700, fontSize: 11, padding: "3px 8px" }}>
        {title}
      </div>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11 }}>
        <tbody>
          {rows.map(([k, v], i) => (
            <tr key={i}>
              <td style={{ padding: "3px 8px", color: MS.darkBlue, fontWeight: 700, width: "45%" }}>{k}</td>
              <td style={{ padding: "3px 8px" }}>{v}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {note && <div style={{ fontSize: 9.5, color: MS.gray, padding: "2px 8px 6px" }}>{note}</div>}
    </div>
  );
}

function Empty({ children }) {
  return <div style={{ fontSize: 11, color: MS.gray, marginBottom: 10 }}>{children}</div>;
}
