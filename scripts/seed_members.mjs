/**
 * Seed rs_members and rs_committees from the unitedstates/congress-legislators
 * public dataset. Local mirror of api/_handlers/sync-repspace.js for running
 * against a dev database; production uses the weekly cron instead.
 *
 * Applies sql/repspace_schema.sql first, so a fresh database needs no manual
 * migration step before this runs.
 *
 * Run: npm run seed:repspace   (requires DATABASE_URL)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const LEGISLATORS_URL = 'https://unitedstates.github.io/congress-legislators/legislators-current.json';
const COMMITTEES_URL = 'https://unitedstates.github.io/congress-legislators/committees-current.json';
const MEMBERSHIP_URL = 'https://unitedstates.github.io/congress-legislators/committee-membership-current.json';
const PHOTO_BASE = 'https://unitedstates.github.io/images/congress/225x275';

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': 'CheckYourRepresentative.com civic education' } });
  if (!r.ok) throw new Error(`${url}: HTTP ${r.status}`);
  return r.json();
}

async function run() {
  if (!process.env.DATABASE_URL) throw new Error('DATABASE_URL not set');
  const client = await pool.connect();
  try {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const schema = fs.readFileSync(path.join(here, '..', 'sql', 'repspace_schema.sql'), 'utf8');
    await client.query(schema);
    console.log('Schema applied.');

    const legislators = await getJson(LEGISLATORS_URL);
    let members = 0;
    await client.query('UPDATE rs_members SET active = FALSE');
    for (const l of legislators) {
      const id = l.id && l.id.bioguide;
      const name = l.name || {};
      const terms = l.terms || [];
      const current = terms[terms.length - 1];
      if (!id || !current) continue;
      const chamber = current.type === 'sen' ? 'senate' : 'house';
      const d = Number(current.district);
      const district = chamber === 'house'
        ? current.state + '-' + (d === 0 ? 'AL' : String(d).padStart(2, '0'))
        : null;
      await client.query(
        `INSERT INTO rs_members (bioguide_id, first_name, last_name, full_name, chamber, state,
           district, party, birthday, first_term_start, term_start, term_end,
           phone, website, contact_form, photo_url, active, synced_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,TRUE,now())
         ON CONFLICT (bioguide_id) DO UPDATE SET
           first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name,
           full_name = EXCLUDED.full_name, chamber = EXCLUDED.chamber,
           state = EXCLUDED.state, district = EXCLUDED.district, party = EXCLUDED.party,
           birthday = EXCLUDED.birthday, first_term_start = EXCLUDED.first_term_start,
           term_start = EXCLUDED.term_start, term_end = EXCLUDED.term_end,
           phone = EXCLUDED.phone, website = EXCLUDED.website,
           contact_form = EXCLUDED.contact_form, photo_url = EXCLUDED.photo_url,
           active = TRUE, synced_at = now()`,
        [id, name.first || null, name.last || null,
         name.official_full || [name.first, name.last].filter(Boolean).join(' '),
         chamber, current.state, district, current.party || null,
         (l.bio && l.bio.birthday) || null, terms[0].start || null,
         current.start || null, current.end || null, current.phone || null,
         current.url || null, current.contact_form || null, `${PHOTO_BASE}/${id}.jpg`]
      );
      members++;
    }
    console.log(`${members} members seeded.`);

    const [committees, membership] = await Promise.all([
      getJson(COMMITTEES_URL), getJson(MEMBERSHIP_URL),
    ]);
    const parentName = {};
    const subName = {};
    for (const c of committees) {
      parentName[c.thomas_id] = c.name;
      for (const s of c.subcommittees || []) {
        subName[c.thomas_id + s.thomas_id] = { parent: c.thomas_id, name: s.name };
      }
    }
    await client.query('DELETE FROM rs_committees');
    let rows = 0;
    for (const [code, roster] of Object.entries(membership)) {
      const sub = subName[code];
      const parentCode = sub ? sub.parent : code;
      const committeeName = parentName[parentCode];
      if (!committeeName) continue;
      for (const m of roster) {
        if (!m.bioguide) continue;
        const r = await client.query(
          `INSERT INTO rs_committees (bioguide_id, committee_code, committee_name, subcommittee, role, rank)
           SELECT $1,$2,$3,$4,$5,$6 WHERE EXISTS (SELECT 1 FROM rs_members WHERE bioguide_id = $1)
           ON CONFLICT (bioguide_id, committee_code, subcommittee) DO NOTHING`,
          [m.bioguide, parentCode, committeeName, sub ? sub.name : '',
           m.title || null, Number.isFinite(m.rank) ? m.rank : null]
        );
        rows += r.rowCount;
      }
    }
    console.log(`${rows} committee rows seeded. Done.`);
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
