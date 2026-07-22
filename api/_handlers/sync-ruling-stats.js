// =============================================================================
// GET /api/cron?op=sync-ruling-stats - recompute judge_ruling_stats.
//
// Pure aggregation over judicial_opinions, one upsert per judge with any
// opinions on file. CourtListener's opinion type codes group as:
//   majority     010combined, 015unamimous, 020lead, 025plurality,
//                080onthemerits (the opinion that decides the case)
//   concurrence  030concurrence, 035concurrenceinpart
//   dissent      040dissent
// Everything else (addenda, remittitur, rehearing) counts toward the total
// only. Affirmed and reversed counts come from the outcome column, which
// stays NULL until a cluster-level pass exists, and average citations
// likewise; the UI presents those as coverage gaps, never as zeros.
// =============================================================================
import { sql, hasDb } from "../_db.js";

export default async function handler(req, res) {
  if (!hasDb) return res.status(500).json({ error: "no database configured" });

  try {
    await ensureSchema();

    const result = await sql`
      INSERT INTO judge_ruling_stats
        (cl_person_id, total_opinions, majority_count, concurrence_count, dissent_count,
         other_count, affirmed_count, reversed_count, avg_citations,
         first_opinion_date, last_opinion_date, computed_at)
      SELECT
        cl_person_id,
        count(*)::int,
        count(*) FILTER (WHERE opinion_type IN ('010combined','015unamimous','020lead','025plurality','080onthemerits'))::int,
        count(*) FILTER (WHERE opinion_type IN ('030concurrence','035concurrenceinpart'))::int,
        count(*) FILTER (WHERE opinion_type = '040dissent')::int,
        count(*) FILTER (WHERE opinion_type IS NULL OR opinion_type NOT IN
          ('010combined','015unamimous','020lead','025plurality','080onthemerits',
           '030concurrence','035concurrenceinpart','040dissent'))::int,
        count(*) FILTER (WHERE outcome = 'affirmed')::int,
        count(*) FILTER (WHERE outcome = 'reversed')::int,
        avg(citation_count),
        min(date_filed),
        max(date_filed),
        now()
      FROM judicial_opinions
      GROUP BY cl_person_id
      ON CONFLICT (cl_person_id) DO UPDATE SET
        total_opinions = EXCLUDED.total_opinions,
        majority_count = EXCLUDED.majority_count,
        concurrence_count = EXCLUDED.concurrence_count,
        dissent_count = EXCLUDED.dissent_count,
        other_count = EXCLUDED.other_count,
        affirmed_count = EXCLUDED.affirmed_count,
        reversed_count = EXCLUDED.reversed_count,
        avg_citations = EXCLUDED.avg_citations,
        first_opinion_date = EXCLUDED.first_opinion_date,
        last_opinion_date = EXCLUDED.last_opinion_date,
        computed_at = now()
      RETURNING cl_person_id`;

    return res.status(200).json({ ok: true, judgesWithStats: result.length });
  } catch (err) {
    return res.status(500).json({ error: "sync_ruling_stats_failed", detail: String(err.message || err) });
  }
}

async function ensureSchema() {
  const EXPECTED = ["cl_person_id", "total_opinions", "majority_count", "concurrence_count",
    "dissent_count", "other_count", "affirmed_count", "reversed_count", "avg_citations",
    "first_opinion_date", "last_opinion_date", "computed_at"];
  const table = await sql`
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'judge_ruling_stats'`;
  if (table.length) {
    const cols = await sql`
      SELECT column_name FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'judge_ruling_stats'`;
    const have = new Set(cols.map(c => c.column_name));
    const mismatch = EXPECTED.some(c => !have.has(c)) || have.size !== EXPECTED.length;
    if (mismatch) await sql`DROP TABLE judge_ruling_stats CASCADE`;
  }
  await sql`
    CREATE TABLE IF NOT EXISTS judge_ruling_stats (
      cl_person_id        INT PRIMARY KEY,
      total_opinions      INT NOT NULL,
      majority_count      INT NOT NULL,
      concurrence_count   INT NOT NULL,
      dissent_count       INT NOT NULL,
      other_count         INT NOT NULL,
      affirmed_count      INT,
      reversed_count      INT,
      avg_citations       NUMERIC(8,2),
      first_opinion_date  DATE,
      last_opinion_date   DATE,
      computed_at         TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
}
