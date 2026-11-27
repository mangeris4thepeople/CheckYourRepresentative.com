// =============================================================================
// api/_seo/util.js - shared helpers for the server-rendered public pages
// (member profiles, state delegations, bill pages, sitemap).
//
// Everything here is pure: no database, no network. House style: no em dashes
// or en dashes anywhere in code or copy.
// =============================================================================

// The live site answers on the www host (the bare domain forwards to it), so
// every canonical URL, sitemap entry, and structured data link uses www.
// Pointing these at the bare domain would send search engines to a redirect.
export const ORIGIN = "https://www.checkyourrepresentative.com";
export const SITE = "CheckYourRepresentative.com";

// State and territory names for every delegation in rs_members.
export const STATES = {
  AL: "Alabama", AK: "Alaska", AZ: "Arizona", AR: "Arkansas", CA: "California",
  CO: "Colorado", CT: "Connecticut", DE: "Delaware", FL: "Florida", GA: "Georgia",
  HI: "Hawaii", ID: "Idaho", IL: "Illinois", IN: "Indiana", IA: "Iowa",
  KS: "Kansas", KY: "Kentucky", LA: "Louisiana", ME: "Maine", MD: "Maryland",
  MA: "Massachusetts", MI: "Michigan", MN: "Minnesota", MS: "Mississippi", MO: "Missouri",
  MT: "Montana", NE: "Nebraska", NV: "Nevada", NH: "New Hampshire", NJ: "New Jersey",
  NM: "New Mexico", NY: "New York", NC: "North Carolina", ND: "North Dakota", OH: "Ohio",
  OK: "Oklahoma", OR: "Oregon", PA: "Pennsylvania", RI: "Rhode Island", SC: "South Carolina",
  SD: "South Dakota", TN: "Tennessee", TX: "Texas", UT: "Utah", VT: "Vermont",
  VA: "Virginia", WA: "Washington", WV: "West Virginia", WI: "Wisconsin", WY: "Wyoming",
  DC: "District of Columbia", PR: "Puerto Rico", GU: "Guam", VI: "U.S. Virgin Islands",
  AS: "American Samoa", MP: "Northern Mariana Islands",
};

// Seats that send a non-voting delegate (or, for Puerto Rico, a resident
// commissioner) to the House rather than a voting representative.
const DELEGATE_SEATS = new Set(["DC", "GU", "VI", "AS", "MP"]);

export function esc(v) {
  return String(v ?? "")
    .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

// JSON-LD goes inside a <script> tag: escape the characters that could close
// it or start a comment, and keep the output plain ASCII safe.
export function jsonLd(obj) {
  return JSON.stringify(obj)
    .replace(/</g, "\\u003c").replace(/>/g, "\\u003e").replace(/&/g, "\\u0026")
    .replace(/\u2028/g, "\\u2028").replace(/\u2029/g, "\\u2029");
}

export function kebab(s) {
  return String(s || "")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "");
}

export function stateSlug(code) { return kebab(STATES[code] || code); }

const SLUG_TO_STATE = Object.fromEntries(Object.keys(STATES).map((c) => [stateSlug(c), c]));
export function stateFromSlug(slug) {
  const s = String(slug || "").toLowerCase();
  if (SLUG_TO_STATE[s]) return SLUG_TO_STATE[s];
  const up = s.toUpperCase();
  return STATES[up] ? up : null;
}

export function memberSlug(m) { return `${kebab(m.full_name)}-${String(m.bioguide_id).toLowerCase()}`; }
export function memberPath(m) { return `/rep/${memberSlug(m)}`; }
export function statePath(code) { return `/congress/${stateSlug(code)}`; }
export function billPath(id) { return `/bill/${String(id).toLowerCase()}`; }

export function ordinal(n) {
  const v = Number(n);
  const mod100 = v % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${v}th`;
  return `${v}${["th", "st", "nd", "rd"][v % 10] || "th"}`;
}

export function partyLetter(p) {
  const s = String(p || "").toLowerCase();
  if (s.startsWith("rep")) return "R";
  if (s.startsWith("dem")) return "D";
  if (s.startsWith("ind")) return "I";
  return (p || "?").slice(0, 1).toUpperCase();
}

// "CO-04" -> { num: 4 }, "AK-AL" -> { atLarge: true }
export function districtParts(district) {
  const m = String(district || "").match(/^([A-Z]{2})-(\d{1,2}|AL)$/);
  if (!m) return null;
  return m[2] === "AL" ? { state: m[1], atLarge: true } : { state: m[1], num: parseInt(m[2], 10) };
}

// Short tag used in titles and lists: "R-CO-04", "D-CO".
export function memberTag(m) {
  const p = partyLetter(m.party);
  if (m.chamber === "house" && m.district) return `${p}-${m.district}`;
  return `${p}-${m.state}`;
}

// Honorific used in running text.
export function honorific(m) {
  if (m.chamber === "senate") return "Sen.";
  if (m.state === "PR") return "Resident Commissioner";
  if (DELEGATE_SEATS.has(m.state)) return "Del.";
  return "Rep.";
}

// Full role line: "U.S. Representative for Colorado's 4th Congressional District".
export function roleLine(m) {
  const st = STATES[m.state] || m.state;
  if (m.chamber === "senate") return `U.S. Senator for ${st}`;
  if (m.state === "PR") return "Resident Commissioner of Puerto Rico in the U.S. House of Representatives";
  if (DELEGATE_SEATS.has(m.state)) {
    const place = m.state === "DC" ? "the District of Columbia" : st;
    return `Delegate to the U.S. House of Representatives for ${place}`;
  }
  const d = districtParts(m.district);
  const poss = /s$/i.test(st) ? `${st}'` : `${st}'s`;
  if (!d) return `U.S. Representative for ${st}`;
  if (d.atLarge) return `U.S. Representative for ${poss} At-Large Congressional District`;
  return `U.S. Representative for ${poss} ${ordinal(d.num)} Congressional District`;
}

// Short seat label for cards: "4th District", "At-Large", "Senator".
export function seatLabel(m) {
  if (m.chamber === "senate") return "U.S. Senator";
  if (m.state === "PR") return "Resident Commissioner";
  if (DELEGATE_SEATS.has(m.state)) return "Delegate";
  const d = districtParts(m.district);
  if (!d) return "U.S. Representative";
  return d.atLarge ? "At-Large District" : `${ordinal(d.num)} District`;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July",
  "August", "September", "October", "November", "December"];

// DATE columns arrive as Date objects or ISO strings depending on the
// driver; read the calendar day in UTC either way so nothing shifts a day.
export function ymd(v) {
  if (!v) return null;
  if (v instanceof Date) {
    if (isNaN(v.getTime())) return null;
    return { y: v.getUTCFullYear(), m: v.getUTCMonth() + 1, d: v.getUTCDate() };
  }
  const m = String(v).match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? { y: +m[1], m: +m[2], d: +m[3] } : null;
}
export function fmtDate(v) {
  const p = ymd(v);
  return p ? `${MONTHS[p.m - 1]} ${p.d}, ${p.y}` : "";
}
export function isoDate(v) {
  const p = ymd(v);
  return p ? `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}` : null;
}
export function yearOf(v) { const p = ymd(v); return p ? p.y : null; }

// A missing amount is unknown, not zero: Number(null) is 0, so stop here and
// let the caller say "Not reported" instead of printing $0 as fact.
export function money(v) {
  if (v == null || v === "") return "";
  const n = Number(v);
  if (!Number.isFinite(n)) return "";
  const r = Math.round(n);
  return (r < 0 ? "-$" : "$") + Math.abs(r).toLocaleString("en-US");
}
export function num(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n.toLocaleString("en-US") : "";
}
export function pct(part, whole) {
  const a = Number(part), b = Number(whole);
  if (!Number.isFinite(a) || !Number.isFinite(b) || b <= 0) return null;
  return Math.round((a / b) * 1000) / 10;
}

// ---- bills ----

const BILL_TYPES = {
  hr: ["H.R.", "house-bill", "House Bill"],
  s: ["S.", "senate-bill", "Senate Bill"],
  hres: ["H.Res.", "house-resolution", "House Resolution"],
  sres: ["S.Res.", "senate-resolution", "Senate Resolution"],
  hjres: ["H.J.Res.", "house-joint-resolution", "House Joint Resolution"],
  sjres: ["S.J.Res.", "senate-joint-resolution", "Senate Joint Resolution"],
  hconres: ["H.Con.Res.", "house-concurrent-resolution", "House Concurrent Resolution"],
  sconres: ["S.Con.Res.", "senate-concurrent-resolution", "Senate Concurrent Resolution"],
};

export function parseBillId(id) {
  const m = String(id || "").toLowerCase().trim()
    .match(/^(hr|hres|hjres|hconres|s|sres|sjres|sconres)-(\d{1,5})-(\d{2,3})$/);
  if (!m) return null;
  return { id: m[0], type: m[1], number: m[2], congress: parseInt(m[3], 10) };
}
export function billLabel(b) { return `${(BILL_TYPES[b.type] || [b.type.toUpperCase()])[0]} ${b.number}`; }
export function billKind(b) { return (BILL_TYPES[b.type] || [null, null, "Bill"])[2]; }
export function congressGovBillUrl(b) {
  const t = BILL_TYPES[b.type];
  if (!t) return "https://www.congress.gov/";
  return `https://www.congress.gov/bill/${ordinal(b.congress)}-congress/${t[1]}/${b.number}`;
}

// Search snippet limits: Google shows about 60 characters of a title and
// about 155 of a meta description before it truncates them itself.
export const TITLE_MAX = 60;
export const DESC_MAX = 155;

// Trim running text to `max` characters (ellipsis included) without cutting
// a word.
export function clip(s, max = DESC_MAX) {
  const t = String(s || "").replace(/\s+/g, " ").trim();
  if (t.length <= max) return t;
  const cut = t.slice(0, max - 3);
  const at = cut.lastIndexOf(" ");
  return (at > max / 3 ? cut.slice(0, at) : cut).replace(/[,;:.\s]+$/, "") + "...";
}

// Build a meta description from whole sentences: each one is added only if
// it still fits, so the snippet never ends mid-thought. If even the first
// does not fit, it is clipped.
export function fitSentences(bits, max = DESC_MAX) {
  const list = bits.map(clean).filter(Boolean);
  let out = "";
  for (const b of list) {
    const next = out ? `${out} ${b}` : b;
    if (next.length <= max) out = next;
  }
  return out || clip(list[0], max);
}

// Pick a page title that fits TITLE_MAX. Candidates run from most to least
// descriptive; the first one that fits wins, and the site name is appended
// only when there is room for it. If none fit, the last is clipped.
export function fitTitle(...candidates) {
  const list = candidates.map(clean).filter(Boolean);
  for (const c of list) {
    if (`${c} | ${SITE}`.length <= TITLE_MAX) return `${c} | ${SITE}`;
    if (c.length <= TITLE_MAX) return c;
  }
  return clip(list[list.length - 1] || SITE, TITLE_MAX);
}

// The house style bans em and en dashes; source titles from Congress.gov
// sometimes carry them, so normalize anything we print.
export function clean(s) {
  return String(s ?? "").replace(/\s*\u2014\s*/g, ", ").replace(/\u2013/g, "-").replace(/\s+/g, " ").trim();
}
