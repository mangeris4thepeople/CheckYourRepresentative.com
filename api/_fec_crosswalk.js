// =============================================================================
// api/_fec_crosswalk.js - check each member's stored FEC candidate id against
// the public bioguide-to-FEC crosswalk before the finance syncs use it.
//
// Why: the finance syncs used to match members to FEC candidates by state
// (and House district) plus last name only, so a different person with the
// same last name could be attached to a member's page. Verified on
// 2026-11-28 against fec.gov: Sen. Darline Graham showed GRAHAM, LINDSEY O.
// (S0SC00149), Rep. Troy Nehls showed NEHLS, TREVER (H6TX22283), Rep. April
// McClain Delaney showed DELANEY, JOHN K (H2MD06195), and seven more. FEC's
// candidate search also files candidates under their newest district, so a
// redistricted seat can turn up another same-name candidate.
//
// Source of truth, in order:
//   1. unitedstates/congress-legislators (legislators-current.json), the
//      public dataset sync-repspace.js already reads. Its id.fec list is the
//      member's own FEC candidate ids. If the stored id is not on that list,
//      the listed id FEC shows for this chamber with the latest cycle wins.
//   2. A member the crosswalk lists with no FEC id (new appointees, for
//      example) keeps a stored id only if the FEC candidate name has the same
//      last name and a compatible first name. Otherwise the id is cleared, so
//      the page shows no campaign money rather than someone else's.
// Every change is returned to the caller and reported in the sync's JSON.
// If the crosswalk cannot be fetched, nothing is changed.
// =============================================================================

const LEGISLATORS_URL = "https://unitedstates.github.io/congress-legislators/legislators-current.json";
const FEC_BASE = "https://api.open.fec.gov/v1";
const FEC_API_KEY = process.env.FEC_API_KEY;
const TITLES = new Set(["mr", "mrs", "ms", "dr", "jr", "sr", "ii", "iii", "iv", "v", "hon", "rev", "md"]);

function norm(s) {
  return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
}
function tokens(s) {
  return norm(s).split(/[^a-z]+/).filter(t => t && !TITLES.has(t));
}

// FEC names are "LASTNAME, FIRSTNAME MIDDLE SUFFIX"; ours are "Firstname Lastname".
// Same person: the FEC last name is the last name in our name, and some given
// name shares its first three letters (Troy and Trever do not; Ted and TED do).
// Nicknames FEC does not list (Chuck for CHARLES) fail and are left unmatched
// for a human to patch, the same rule the syncs already follow.
export function sameCandidateName(ourName, fecName) {
  const [fecLastRaw, fecRest = ""] = String(fecName || "").split(",");
  const fecLast = tokens(fecLastRaw);
  const ours = tokens(ourName);
  if (!fecLast.length || ours.length < 2) return false;
  const ourLast = ours[ours.length - 1];
  if (!fecLast.includes(ourLast)) return false;
  const given = ours.slice(0, -1).filter(t => !fecLast.includes(t));
  const fecGiven = tokens(fecRest);
  return given.some(a => fecGiven.some(b => a === b || (a.length >= 3 && b.length >= 3 && a.slice(0, 3) === b.slice(0, 3))));
}

// The crosswalk seat holder and our seat holder share a last name token, so a
// seat that changed hands between data refreshes is never cross-applied.
export function sameMember(ourName, crosswalkLast) {
  const ours = new Set(tokens(ourName));
  return tokens(crosswalkLast).some(t => ours.has(t));
}

export async function loadCrosswalk() {
  const r = await fetch(LEGISLATORS_URL, { headers: { "User-Agent": "CheckYourRepresentative/1.0 (checkyourrepresentative.com)" } });
  if (!r.ok) throw new Error(`congress-legislators ${r.status}`);
  const people = await r.json();
  const senate = new Map();
  const house = new Map();
  for (const p of people) {
    const t = (p.terms || [])[p.terms.length - 1] || {};
    const fec = Array.isArray(p.id?.fec) ? p.id.fec : [];
    const entry = { bioguide: p.id?.bioguide, last: p.name?.last || "", fec };
    if (t.type === "sen") senate.set(entry.bioguide, { ...entry, fec: fec.filter(id => id.startsWith("S")) });
    if (t.type === "rep") {
      const d = Number(t.district);
      // Same district format the representatives table uses: CO-04, AK-AL.
      const key = t.state + "-" + (d === 0 ? "AL" : String(d).padStart(2, "0"));
      house.set(key, { ...entry, fec: fec.filter(id => id.startsWith("H")) });
    }
  }
  return { senate, house };
}

async function fecCandidates(ids) {
  const out = new Map();
  const list = [...new Set(ids)];
  for (let i = 0; i < list.length; i += 100) {
    const qs = new URLSearchParams({ api_key: FEC_API_KEY, per_page: "100" });
    for (const id of list.slice(i, i + 100)) qs.append("candidate_id", id);
    const r = await fetch(`${FEC_BASE}/candidates/?${qs}`);
    if (!r.ok) throw new Error(`FEC ${r.status} on /candidates/`);
    const data = await r.json();
    for (const c of data.results || []) out.set(c.candidate_id, c);
  }
  return out;
}

function latestCycle(c) {
  return Array.isArray(c.cycles) && c.cycles.length ? Math.max(...c.cycles) : 0;
}

// rows: [{ key, name, fec_candidate_id, entry }] where entry is the crosswalk
// record for that member (or undefined). office: "H" or "S".
// Returns { updates: [{ key, name, from, to, reason }] } for the caller to write.
export async function reconcile(rows, office) {
  const listedIds = [];
  const checkIds = [];
  for (const row of rows) {
    if (!row.entry) continue;
    if (row.entry.fec.length) {
      if (!row.entry.fec.includes(row.fec_candidate_id)) listedIds.push(...row.entry.fec);
    } else if (row.fec_candidate_id) {
      checkIds.push(row.fec_candidate_id);
    }
  }
  if (!listedIds.length && !checkIds.length) return { updates: [] };
  const fec = await fecCandidates([...listedIds, ...checkIds]);

  const updates = [];
  for (const row of rows) {
    if (!row.entry) continue;
    const stored = row.fec_candidate_id || null;
    if (row.entry.fec.length) {
      if (row.entry.fec.includes(stored)) continue;
      const best = row.entry.fec
        .map(id => fec.get(id))
        .filter(c => c && c.office === office)
        .sort((a, b) => latestCycle(b) - latestCycle(a))[0];
      if (best && best.candidate_id !== stored) {
        updates.push({ key: row.key, name: row.name, from: stored, to: best.candidate_id, fecName: best.name, reason: "crosswalk" });
      }
    } else if (stored) {
      const c = fec.get(stored);
      if (c && !sameCandidateName(row.name, c.name)) {
        updates.push({ key: row.key, name: row.name, from: stored, to: null, fecName: c.name, reason: "name_mismatch" });
      }
    }
  }
  return { updates };
}
