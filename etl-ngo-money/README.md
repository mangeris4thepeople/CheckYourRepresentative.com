# NGO Money Loop ETL

Closes the loop between three public records:

1. **Colorado TRACER** (Secretary of State): non-individual contributions to
   state committees, from the yearly bulk data files.
2. **ProPublica Nonprofit Explorer** (IRS Form 990 data): who each contributor
   legally is: EIN, legal name, 501(c) subsection, latest total revenue.
3. **IRS Auto-Revocation List**: whose tax exemption has been automatically
   revoked for failing to file for three consecutive years.

Appearing in this data does not imply wrongdoing. Contributing to committees
is legal and publicly reported by design; the loop simply lines the public
records up in one place.

## Setup

```bash
cd etl-ngo-money
npm install
```

The schema is applied automatically at the start of every pipeline run
(`node etl/apply_schema.mjs`, idempotent). To apply it by hand instead:

```bash
psql "$DATABASE_URL" -f sql/ngo_money_schema.sql
```

The `ngo_money_loop` view joins against the existing `organizations` and
`funding_events` tables from `migrations/schema_v2.sql` for the
"Federal $ Received" column, so that schema must exist first.

## Backfill

```bash
export DATABASE_URL=...           # Neon connection string
node etl/tracer_etl.mjs 2024 2025 2026
node etl/propublica_enrich.mjs --limit 200
node etl/irs_revocations.mjs
```

All three are idempotent and safe to re-run. The enrichment step writes
crosswalk rows with status `candidate` only; a human confirms or rejects each
match on `/admin/crosswalk` before it is treated as verified. The site's loop
table shows candidate matches labeled as unreviewed.

## Recurring runs

`.github/workflows/etl-ngo-money.yml` runs the same three steps weekly using
the `DATABASE_URL` repo secret, and can be triggered manually from the
Actions tab (use that for the first backfill).
