// =============================================================================
// Privacy respecting site counters. Two ops:
//   POST /api/metric?m=visit        -> add one to today's named counter
//   GET  /api/metrics-summary       -> last 30 days of counters, public
//
// The whole design is anonymous aggregates: one row per day per metric
// name holding a count, nothing else. No IP, no user agent, no cookie, no
// user id, nothing that could tie a count to a person, consistent with
// the privacy policy's no tracking commitment. The summary is public on
// purpose; the site's own transparency standard applies to itself.
//
// The metric name allowlist keeps the endpoint from becoming a free form
// write channel. Being unauthenticated, the counters are approximate by
// nature (they measure honestly behaving browsers), which is all a
// conversion funnel needs.
// =============================================================================
import { sql, hasDb } from "../_db.js";

// Metrics a browser may increment. vote_cast and new_account are NOT here
// on purpose: they only ever increment server side inside the vote and
// auth handlers, so the numbers a buyer would care about cannot be
// inflated by anyone hitting this endpoint.
const ALLOWED = new Set([
  "visit",
  "walkthrough_dismissed",
  "vote_intent",
  "signin_request",
  "signin_complete",
]);

export async function bumpMetric(name) {
  // Shared with the auth handlers for server side counts; never throws,
  // metrics must not break the flows they observe.
  try {
    await ensureSchema();
    await sql`
      INSERT INTO site_metrics (day, metric, count)
      VALUES (CURRENT_DATE, ${name}, 1)
      ON CONFLICT (day, metric) DO UPDATE SET count = site_metrics.count + 1`;
  } catch { /* counting is best effort */ }
}

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  if (!hasDb) return res.status(200).json({ ok: false });

  try {
    if (req.query.op === "metric") {
      if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
      const m = String(req.query.m || "").trim();
      if (!ALLOWED.has(m)) return res.status(400).json({ error: "unknown metric" });
      await bumpMetric(m);
      return res.status(200).json({ ok: true });
    }

    await ensureSchema();
    const rows = await sql`
      SELECT day, metric, count FROM site_metrics
      WHERE day >= CURRENT_DATE - 60
      ORDER BY day DESC, metric ASC`;

    const allTime = await sql`
      SELECT metric, SUM(count)::int AS total FROM site_metrics GROUP BY metric`;
    const totals = Object.fromEntries(allTime.map(r => [r.metric, Number(r.total)]));

    const bucket = (from, to) => {
      const out = {};
      for (const r of rows) {
        const age = Math.floor((Date.now() - new Date(r.day).getTime()) / 86400000);
        if (age >= from && age < to) out[r.metric] = (out[r.metric] || 0) + Number(r.count);
      }
      return out;
    };
    const last7 = bucket(0, 7);
    const prior7 = bucket(7, 14);

    const rate = (num, den) => (den > 0 ? Math.round((num / den) * 1000) / 10 : null);
    // The funnel a valuation conversation actually asks about, computed
    // from all-time totals. Percentages; null until the denominator exists.
    const funnel = {
      visit_to_signin_request_pct: rate(totals.signin_request || 0, totals.visit || 0),
      signin_request_to_complete_pct: rate(totals.signin_complete || 0, totals.signin_request || 0),
      vote_intent_to_signin_request_pct: rate(totals.signin_request || 0, totals.vote_intent || 0),
      signin_complete_to_first_votes_note:
        "vote_cast counts every vote recorded, server side only; divide by new_account for votes per account",
      votes_per_account: totals.new_account > 0
        ? Math.round(((totals.vote_cast || 0) / totals.new_account) * 10) / 10 : null,
    };

    return res.status(200).json({
      ok: true, totals, last7, prior7, funnel, days: rows.slice(0, 120),
    });
  } catch (err) {
    return res.status(500).json({ error: "metrics_failed", detail: String(err.message || err) });
  }
}

async function ensureSchema() {
  await sql`
    CREATE TABLE IF NOT EXISTS site_metrics (
      day    DATE NOT NULL,
      metric TEXT NOT NULL,
      count  INTEGER NOT NULL DEFAULT 0,
      PRIMARY KEY (day, metric)
    )`;
}
