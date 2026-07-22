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

const ALLOWED = new Set([
  "visit",
  "walkthrough_dismissed",
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
      WHERE day >= CURRENT_DATE - 30
      ORDER BY day DESC, metric ASC`;
    const totals = {};
    for (const r of rows) totals[r.metric] = (totals[r.metric] || 0) + Number(r.count);
    return res.status(200).json({ ok: true, days: rows, totals });
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
