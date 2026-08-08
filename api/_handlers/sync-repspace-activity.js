// =============================================================================
// GET /api/cron?op=sync-repspace-activity - RepSpace vote stats + wall posts.
//
// Daily incremental crawl, three chunks under one time budget:
//   1. House roll calls: walks forward from a cursor through the same
//      Congress.gov house-vote endpoints the Roll Calls tab reads, and
//      accumulates per member counters into rs_stats.
//   2. Senate roll calls: same, from the official senate.gov XML.
//   3. Wall posts: for the members whose wall is stalest, pulls their most
//      recently sponsored legislation from Congress.gov. Titles verbatim,
//      source_url on every row (enforced NOT NULL by the schema). Nothing
//      is ever paraphrased into a member's mouth.
//
// Cursors live in rs_state, so each run picks up where the last stopped and
// the crawl fits Vercel's 60 second function cap no matter how far behind it
// is. Manual runs can push harder: ?houseVotes=20&senateVotes=20&walls=40.
//
// Requires CONGRESS_API_KEY. Reached only through api/cron.js (CRON_SECRET).
// =============================================================================
import { sql, hasDb } from "../_db.js";
import { ensureSchema } from "./sync-repspace.js";

const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const CONGRESS = 119;
const SESSION = 2;
const TIME_BUDGET_MS = 40_000;
const SENATE_HEADERS = { "User-Agent": "CheckYourRepresentative.com civic education (info@checkyourrepresentative.com)" };

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });
  if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });

  const startedAt = Date.now();
  const left = () => TIME_BUDGET_MS - (Date.now() - startedAt);

  try {
    await ensureSchema();
    const members = await loadMembers();

    const houseCap = cap(req.query.houseVotes, 6);
    const senateCap = cap(req.query.senateVotes, 6);
    const wallCap = cap(req.query.walls, 20);

    const house = await crawlHouseVotes(members, houseCap, left);
    const senate = left() > 5000 ? await crawlSenateVotes(members, senateCap, left) : { processed: 0 };
    const walls = left() > 5000 ? await crawlWalls(members, wallCap, left) : { members: 0, posts: 0 };

    return res.status(200).json({ ok: true, house, senate, walls });
  } catch (err) {
    return res.status(500).json({ error: "sync_repspace_activity_failed", detail: String(err.message || err) });
  }
}

function cap(v, dflt) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? Math.min(50, Math.max(0, n)) : dflt;
}

async function loadMembers() {
  const rows = await sql`
    SELECT bioguide_id, chamber, state, last_name FROM rs_members WHERE active`;
  const byId = new Map();
  const senateByStateLast = new Map();
  for (const r of rows) {
    byId.set(r.bioguide_id, r);
    if (r.chamber === "senate") {
      // Senate XML carries names, not bioguide ids. state+last name is
      // unique in the current Senate; an ambiguous key gets dropped rather
      // than guessed.
      const key = `${r.state}|${(r.last_name || "").toLowerCase()}`;
      senateByStateLast.set(key, senateByStateLast.has(key) ? null : r.bioguide_id);
    }
  }
  return { byId, senateByStateLast };
}

// ---- cursors ----

async function getCursor(key) {
  const r = await sql`SELECT value FROM rs_state WHERE key = ${key}`;
  return r.length ? parseInt(r[0].value, 10) || 0 : 0;
}

async function setCursor(key, value) {
  await sql`
    INSERT INTO rs_state (key, value, updated_at) VALUES (${key}, ${String(value)}, now())
    ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
}

// ---- house ----

async function crawlHouseVotes(members, maxVotes, left) {
  const cursorKey = `house_${CONGRESS}_${SESSION}`;
  let cursor = await getCursor(cursorKey);
  let processed = 0;
  const skipped = [];

  while (processed < maxVotes && left() > 8000) {
    const next = cursor + 1;
    const url = `https://api.congress.gov/v3/house-vote/${CONGRESS}/${SESSION}/${next}/members?format=json&limit=450&api_key=${CONGRESS_API_KEY}`;
    const r = await fetch(url);
    if (r.status === 404) break; // no such roll call yet, caught up
    if (!r.ok) throw new Error(`congress.gov ${r.status} on house vote ${next}`);
    const data = await r.json();
    const meta = data.houseRollCallVoteMemberVotes || {};
    const results = meta.results || [];
    if (results.length === 0) break;

    const deltas = new Map();
    const voteDate = (meta.startDate || "").slice(0, 10) || null;
    for (const m of results) {
      // The members payload carries bioguideID; fall back to nothing rather
      // than a name guess, House last names collide too often.
      const id = m.bioguideID || m.bioguideId;
      if (!id || !members.byId.has(id)) { skipped.push(next); continue; }
      addDelta(deltas, id, m.voteCast, voteDate);
    }
    await applyDeltas(deltas);
    cursor = next;
    processed++;
  }

  await setCursor(cursorKey, cursor);
  return { processed, cursor, unmatchedRows: skipped.length };
}

// ---- senate ----

async function crawlSenateVotes(members, maxVotes, left) {
  const cursorKey = `senate_${CONGRESS}_${SESSION}`;
  let cursor = await getCursor(cursorKey);
  let processed = 0;
  let unmatched = 0;

  while (processed < maxVotes && left() > 8000) {
    const next = cursor + 1;
    const padded = String(next).padStart(5, "0");
    const url = `https://www.senate.gov/legislative/LIS/roll_call_votes/vote${CONGRESS}${SESSION}/vote_${CONGRESS}_${SESSION}_${padded}.xml`;
    const r = await fetch(url, { headers: SENATE_HEADERS });
    if (r.status === 404) break;
    if (!r.ok) throw new Error(`senate.gov ${r.status} on vote ${next}`);
    const xml = await r.text();
    const blocks = xml.match(/<member>[\s\S]*?<\/member>/g) || [];
    if (blocks.length === 0) break;

    const deltas = new Map();
    const voteDate = parseSenateDate(tag(xml, "vote_date"));
    for (const b of blocks) {
      const key = `${tag(b, "state")}|${decode(tag(b, "last_name")).toLowerCase()}`;
      const id = members.senateByStateLast.get(key);
      if (!id) { unmatched++; continue; }
      addDelta(deltas, id, tag(b, "vote_cast"), voteDate);
    }
    await applyDeltas(deltas);
    cursor = next;
    processed++;
  }

  await setCursor(cursorKey, cursor);
  return { processed, cursor, unmatchedRows: unmatched };
}

// senate.gov dates look like "January 3, 2026, 12:00 PM"; keep just the date.
function parseSenateDate(s) {
  const d = new Date((s || "").split(",").slice(0, 2).join(","));
  return isNaN(d) ? null : d.toISOString().slice(0, 10);
}

// ---- shared counter logic ----

function addDelta(deltas, id, voteCast, voteDate) {
  const d = deltas.get(id) || { total: 0, cast: 0, missed: 0, yes: 0, no: 0, present: 0, date: voteDate };
  d.total++;
  const s = (voteCast || "").toLowerCase();
  if (s.startsWith("yea") || s.startsWith("aye") || s === "yes" || s.startsWith("guilty")) { d.cast++; d.yes++; }
  else if (s.startsWith("nay") || s === "no" || s.startsWith("not guilty")) { d.cast++; d.no++; }
  else if (s.startsWith("present")) { d.cast++; d.present++; }
  else d.missed++;
  if (voteDate) d.date = voteDate;
  deltas.set(id, d);
}

async function applyDeltas(deltas) {
  const rows = [...deltas.entries()];
  for (let i = 0; i < rows.length; i += 100) {
    const batch = rows.slice(i, i + 100);
    const params = [];
    const tuples = batch.map(([id, d]) => {
      params.push(id, CONGRESS, d.total, d.cast, d.missed, d.yes, d.no, d.present, d.date);
      const base = params.length - 9;
      return `($${base + 1},$${base + 2},$${base + 3},$${base + 4},$${base + 5},$${base + 6},$${base + 7},$${base + 8},$${base + 9})`;
    });
    // EXCLUDED carries this run's deltas; the conflict arm accumulates them
    // onto the standing counters.
    await sql.query(
      `INSERT INTO rs_stats (bioguide_id, congress, votes_total, votes_cast, votes_missed,
                             yes_votes, no_votes, present_votes, last_vote_date)
       VALUES ${tuples.join(",")}
       ON CONFLICT (bioguide_id) DO UPDATE SET
         congress = EXCLUDED.congress,
         votes_total = rs_stats.votes_total + EXCLUDED.votes_total,
         votes_cast = rs_stats.votes_cast + EXCLUDED.votes_cast,
         votes_missed = rs_stats.votes_missed + EXCLUDED.votes_missed,
         yes_votes = rs_stats.yes_votes + EXCLUDED.yes_votes,
         no_votes = rs_stats.no_votes + EXCLUDED.no_votes,
         present_votes = rs_stats.present_votes + EXCLUDED.present_votes,
         last_vote_date = GREATEST(COALESCE(EXCLUDED.last_vote_date, rs_stats.last_vote_date), rs_stats.last_vote_date),
         updated_at = now()`,
      params,
    );
  }
}

// ---- wall posts ----

const BILL_SLUGS = {
  HR: "house-bill", S: "senate-bill", HRES: "house-resolution", SRES: "senate-resolution",
  HJRES: "house-joint-resolution", SJRES: "senate-joint-resolution",
  HCONRES: "house-concurrent-resolution", SCONRES: "senate-concurrent-resolution",
};

function ordinal(n) {
  const rem = n % 100;
  if (rem >= 11 && rem <= 13) return `${n}th`;
  return `${n}${["th", "st", "nd", "rd"][Math.min(n % 10, 4)] || "th"}`;
}

async function crawlWalls(members, maxMembers, left) {
  const stale = await sql`
    SELECT bioguide_id FROM rs_members WHERE active
    ORDER BY wall_synced_at ASC NULLS FIRST, bioguide_id ASC LIMIT ${maxMembers}`;

  let posts = 0;
  let done = 0;
  for (const { bioguide_id } of stale) {
    if (left() < 6000) break;
    const url = `https://api.congress.gov/v3/member/${bioguide_id}/sponsored-legislation?format=json&limit=6&api_key=${CONGRESS_API_KEY}`;
    const r = await fetch(url);
    if (!r.ok) {
      // A member with no sponsored legislation record is fine; only stop on
      // hard failures so one bad id cannot wedge the crawl forever.
      if (r.status !== 404) throw new Error(`congress.gov ${r.status} on member ${bioguide_id}`);
    } else {
      const data = await r.json();
      for (const bill of data.sponsoredLegislation || []) {
        const slug = BILL_SLUGS[(bill.type || "").replace(/\./g, "").toUpperCase()];
        if (!slug || !bill.number || !bill.congress || !bill.title) continue;
        const sourceUrl = `https://www.congress.gov/bill/${ordinal(bill.congress)}-congress/${slug}/${bill.number}`;
        await sql`
          INSERT INTO rs_wall_posts (bioguide_id, posted_at, kind, title, body, source_url)
          VALUES (${bioguide_id}, ${bill.introducedDate || null}, 'sponsored-bill',
                  ${`Introduced ${bill.type} ${bill.number}`}, ${bill.title}, ${sourceUrl})
          ON CONFLICT (bioguide_id, kind, source_url) DO UPDATE SET
            title = EXCLUDED.title, body = EXCLUDED.body, posted_at = EXCLUDED.posted_at`;
        posts++;
      }
    }
    await sql`UPDATE rs_members SET wall_synced_at = now() WHERE bioguide_id = ${bioguide_id}`;
    done++;
  }
  return { members: done, posts };
}

// ---- xml helpers (same shapes rollcall.js parses) ----
function tag(src, name) {
  const m = src.match(new RegExp(`<${name}>([\\s\\S]*?)</${name}>`));
  return m ? m[1].trim() : "";
}
function decode(s) {
  return (s || "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'");
}
