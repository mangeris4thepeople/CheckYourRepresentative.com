// =============================================================================
// GET /api/cron?op=import-retention - load judicial retention election
// results into judicial_retention_results.
//
// Reads data/retention_results.csv from this repo's main branch, which the
// retention-extract workflow produces from the Secretary of State's
// certified Abstract of Votes Cast PDF. The repo is public, so the raw file
// is fetchable without credentials.
//
// Judge matching: the abstract's formal names (middle initials, accents) can
// differ from the OJPE list's names, so rows match by court plus normalized
// last name, falling back to full-name comparison when several judges in
// one court share a last name. A judge named in the abstract but absent
// from co_judges is created. Anything ambiguous is skipped and reported,
// never guessed.
// =============================================================================
import { sql, hasDb } from "../_db.js";
import { parse } from "csv-parse/sync";

const CSV_URL = "https://raw.githubusercontent.com/mangeris4thepeople/CheckYourRepresentative.com/main/data/retention_results.csv";

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    const r = await fetch(CSV_URL);
    if (r.status === 404) {
      return res.status(200).json({ ok: false, reason: "csv_not_extracted_yet" });
    }
    if (!r.ok) throw new Error(`csv fetch ${r.status}`);
    const rows = parse(await r.text(), { columns: true, skip_empty_lines: true, trim: true });

    let imported = 0;
    const skipped = [];
    for (const row of rows) {
      try {
        const courtName = mapCourt(row.court_name);
        if (!courtName) { skipped.push(`unmapped court: ${row.court_name}`); continue; }
        const court = (await sql`SELECT id FROM co_courts WHERE name = ${courtName}`)[0];
        if (!court) { skipped.push(`court not in directory: ${courtName}`); continue; }

        const judgeId = await matchJudge(row.judge_full_name, court.id);
        if (!judgeId) { skipped.push(`ambiguous judge: ${row.judge_full_name} (${courtName})`); continue; }

        const year = parseInt(row.election_year, 10);
        const yes = parseInt(row.yes_votes, 10);
        const no = parseInt(row.no_votes, 10);
        await sql`
          INSERT INTO judicial_retention_results (judge_id, election_year, yes_votes, no_votes, retained)
          VALUES (${judgeId}, ${year}, ${yes}, ${no}, ${yes > no})
          ON CONFLICT (judge_id, election_year) DO UPDATE SET
            yes_votes = EXCLUDED.yes_votes, no_votes = EXCLUDED.no_votes,
            retained = EXCLUDED.retained`;
        imported++;
      } catch (err) {
        skipped.push(`${row.judge_full_name}: ${String(err.message || err).slice(0, 80)}`);
      }
    }

    return res.status(200).json({ ok: true, imported, total: rows.length, skipped: skipped.slice(0, 30) });
  } catch (err) {
    return res.status(500).json({ error: "import_retention_failed", detail: String(err.message || err) });
  }
}

// The abstract names courts in prose. Map onto co_courts names. County
// courts arrive already canonical from the extraction workflow, e.g.
// "Adams County Court", and pass straight through.
function mapCourt(raw) {
  const s = String(raw || "").trim();
  if (/^[A-Za-z ]+ County Court$/.test(s)) return s;
  if (/supreme/i.test(s)) return "Colorado Supreme Court";
  if (/appeals/i.test(s)) return "Colorado Court of Appeals";
  if (/denver probate/i.test(s)) return "Denver Probate Court";
  if (/denver juvenile/i.test(s)) return "Denver Juvenile Court";
  const num = s.match(/(\d+)(?:st|nd|rd|th)?\s+Judicial District/i);
  if (num) {
    const n = parseInt(num[1], 10);
    if (n >= 1 && n <= 22) {
      const suffix = { 1: "1st", 2: "2nd", 3: "3rd", 21: "21st", 22: "22nd" }[n] || `${n}th`;
      return `${suffix} Judicial District Court`;
    }
  }
  const ORDINALS = {
    first: 1, second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6, seventh: 7,
    eighth: 8, ninth: 9, tenth: 10, eleventh: 11, twelfth: 12, thirteenth: 13,
    fourteenth: 14, fifteenth: 15, sixteenth: 16, seventeenth: 17, eighteenth: 18,
    nineteenth: 19, twentieth: 20, "twenty-first": 21, "twenty-second": 22,
  };
  const word = s.match(/((?:twenty-)?[a-z]+)\s+judicial district/i);
  if (word) {
    const n = ORDINALS[word[1].toLowerCase()];
    if (n) {
      const suffix = { 1: "1st", 2: "2nd", 3: "3rd", 21: "21st", 22: "22nd" }[n] || `${n}th`;
      return `${suffix} Judicial District Court`;
    }
  }
  return null;
}

const norm = (s) => String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z ]/g, "").trim();
// Generational suffixes are dropped so "Joseph R. Whitfield, Jr." still
// yields whitfield as the matching token rather than jr.
const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);
const lastName = (s) => {
  const parts = norm(s).split(" ").filter(Boolean).filter(t => !SUFFIXES.has(t));
  return parts.pop() || "";
};

async function matchJudge(fullName, courtId) {
  const last = lastName(fullName);
  if (!last) return null;
  const judges = await sql`SELECT id, full_name FROM co_judges WHERE court_id = ${courtId}`;
  const byLast = judges.filter(j => lastName(j.full_name) === last);
  if (byLast.length === 1) return byLast[0].id;
  if (byLast.length > 1) {
    const exact = byLast.filter(j => norm(j.full_name) === norm(fullName));
    return exact.length === 1 ? exact[0].id : null;
  }
  const created = (await sql`
    INSERT INTO co_judges (full_name, court_id, active)
    VALUES (${fullName}, ${courtId}, TRUE)
    ON CONFLICT (full_name, court_id) DO UPDATE SET synced_at = now()
    RETURNING id`)[0];
  return created.id;
}
