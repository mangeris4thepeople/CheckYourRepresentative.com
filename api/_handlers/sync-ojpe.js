// =============================================================================
// GET /api/cron?op=sync-ojpe - import OJPE judicial performance evaluations.
//
// Source: the Colorado Office of Judicial Performance Evaluation's official
// 2024 full evaluation list. The live state site sits behind CloudFront bot
// protection that blocks server-side fetches (verified live), so this reads
// the Internet Archive's snapshot of the same official page instead. The
// stored narrative_url still points at the live official page, and every
// recommendation string is stored verbatim as published.
//
// Parsing model, verified against the actual page text: sections open with a
// heading like "Fourth Judicial District (El Paso, Teller Counties)", then a
// "District Court Judges" or "<County> County Court Judges" label, then rows
// of "Honorable <name> <RECOMMENDATION>". County court judges are skipped
// and counted: this site's directory covers the state courts in co_courts,
// which has no county courts. Anything that cannot be parsed cleanly is
// skipped and reported, never guessed at.
// =============================================================================
import { sql, hasDb } from "../_db.js";

const EVAL_YEAR = 2024;
const SOURCE_URL = "https://judicialperformance.colorado.gov/2024-judicial-performance-evaluations-full-list";
const ARCHIVE_URL = `https://web.archive.org/web/2024/${SOURCE_URL}`;

const ORDINALS = {
  First: 1, Second: 2, Third: 3, Fourth: 4, Fifth: 5, Sixth: 6, Seventh: 7,
  Eighth: 8, Ninth: 9, Tenth: 10, Eleventh: 11, Twelfth: 12, Thirteenth: 13,
  Fourteenth: 14, Fifteenth: 15, Sixteenth: 16, Seventeenth: 17, Eighteenth: 18,
  Nineteenth: 19, Twentieth: 20, "Twenty-First": 21, "Twenty-Second": 22,
};
const SUFFIX = { 1: "1st", 2: "2nd", 3: "3rd", 21: "21st", 22: "22nd" };
const districtCourtName = (n) => `${SUFFIX[n] || n + "th"} Judicial District Court`;

const RECOMMENDATIONS =
  "MEETS PERFORMANCE STANDARDS|DOES NOT MEET PERFORMANCE STANDARDS|" +
  "NO RECOMMENDATION|NO OPINION|MEETS PERFORMANCE STANDARD|DOES NOT MEET PERFORMANCE STANDARD";

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    const r = await fetch(ARCHIVE_URL, { headers: { "User-Agent": "CheckYourRepresentative.com civic data (info@checkyourrepresentative.com)" } });
    if (!r.ok) {
      const body = await r.text().catch(() => "");
      throw new Error(`archive fetch ${r.status}: ${body.slice(0, 120)}`);
    }
    const html = await r.text();
    const text = html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
      .replace(/&nbsp;/g, " ")
      .replace(/&amp;/g, "&")
      .replace(/&#39;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/\s+/g, " ");

    // Walk headings, section labels, and judge rows in document order so
    // every judge lands under the court heading that precedes them.
    const walker = new RegExp(
      "(Colorado Supreme Court|Court of Appeals" +
      "|((?:Twenty-)?[A-Z][a-z]+) Judicial District\\s*\\(" +
      "|County Court Judges|District Court Judges" +
      `|Honorable ([^]*?) (${RECOMMENDATIONS}))`,
      "g"
    );

    let courtName = null;   // resolved co_courts name for the current section
    let inCounty = false;
    let skippedCounty = 0;
    const unparsed = [];
    const rows = [];        // { judge, courtName, recommendation }

    let m;
    while ((m = walker.exec(text)) !== null) {
      const token = m[1];
      if (token === "Colorado Supreme Court") { courtName = "Colorado Supreme Court"; inCounty = false; continue; }
      if (token === "Court of Appeals") { courtName = "Colorado Court of Appeals"; inCounty = false; continue; }
      if (m[2]) {
        const n = ORDINALS[m[2]];
        courtName = n ? districtCourtName(n) : null;
        if (!n) unparsed.push(`district heading: ${m[2]}`);
        inCounty = false;
        continue;
      }
      if (token === "County Court Judges") { inCounty = true; continue; }
      if (token === "District Court Judges") { inCounty = false; continue; }
      if (m[3]) {
        const judge = m[3].trim().replace(/\s+/g, " ");
        const recommendation = m[4].trim();
        if (inCounty) { skippedCounty++; continue; }
        if (!courtName) { unparsed.push(`no court context for: ${judge}`); continue; }
        if (judge.length > 60) { unparsed.push(`suspicious name: ${judge.slice(0, 80)}`); continue; }
        rows.push({ judge, courtName, recommendation });
      }
    }

    let imported = 0;
    const errors = [];
    for (const row of rows) {
      try {
        const court = (await sql`SELECT id FROM co_courts WHERE name = ${row.courtName}`)[0];
        if (!court) { errors.push(`unknown court ${row.courtName}`); continue; }
        const judge = (await sql`
          INSERT INTO co_judges (full_name, court_id, active)
          VALUES (${row.judge}, ${court.id}, TRUE)
          ON CONFLICT (full_name, court_id) DO UPDATE SET synced_at = now()
          RETURNING id`)[0];
        await sql`
          INSERT INTO ojpe_evaluations (judge_id, eval_year, recommendation, narrative_url)
          VALUES (${judge.id}, ${EVAL_YEAR}, ${row.recommendation}, ${SOURCE_URL})
          ON CONFLICT (judge_id, eval_year) DO UPDATE SET
            recommendation = EXCLUDED.recommendation,
            narrative_url = EXCLUDED.narrative_url`;
        imported++;
      } catch (err) {
        errors.push(`${row.judge}: ${String(err.message || err).slice(0, 100)}`);
      }
    }

    return res.status(200).json({
      ok: true, imported, parsed: rows.length, skippedCountyCourt: skippedCounty,
      unparsed: unparsed.slice(0, 20), errors: errors.slice(0, 20),
    });
  } catch (err) {
    return res.status(500).json({ error: "sync_ojpe_failed", detail: String(err.message || err) });
  }
}
