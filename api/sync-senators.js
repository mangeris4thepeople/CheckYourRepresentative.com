// =============================================================================
// /api/sync-senators.js - fetch all 100 senators from senate.gov XML and
// store them in the senators table. Mirrors api/sync-reps.js's structure;
// the Senate has no districts, so bioguide_id is the primary key instead
// (state alone is not unique, two senators share it).
// Usage: GET /api/sync-senators
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  try {
    const r = await fetch("https://www.senate.gov/general/contact_information/senators_cfm.xml", {
      headers: { "User-Agent": "CheckYourRepresentative/1.0 (checkyourrepresentative.com)" }
    });
    if (!r.ok) throw new Error("senate.gov returned " + r.status);

    const xml = await r.text();
    const members = parseXML(xml);

    await sql`
      CREATE TABLE IF NOT EXISTS senators (
        bioguide_id TEXT PRIMARY KEY,
        name        TEXT,
        party       TEXT,
        state       TEXT,
        class       TEXT,
        phone       TEXT,
        website     TEXT,
        contact_url TEXT,
        updated_at  TIMESTAMPTZ DEFAULT now()
      )
    `;

    let count = 0;
    for (const m of members) {
      await sql`
        INSERT INTO senators (bioguide_id, name, party, state, class, phone, website, contact_url)
        VALUES (${m.bioguide_id}, ${m.name}, ${m.party}, ${m.state}, ${m.class}, ${m.phone}, ${m.website}, ${m.contact_url})
        ON CONFLICT (bioguide_id) DO UPDATE SET
          name = EXCLUDED.name, party = EXCLUDED.party, state = EXCLUDED.state,
          class = EXCLUDED.class, phone = EXCLUDED.phone, website = EXCLUDED.website,
          contact_url = EXCLUDED.contact_url,
          updated_at = now()
      `;
      count++;
    }

    return res.status(200).json({ ok: true, synced: count, sample: members.slice(0, 3) });
  } catch (err) {
    return res.status(500).json({ error: String(err.message || err) });
  }
}

function parseXML(xml) {
  const members = [];
  const blocks = xml.split("<member>").slice(1);

  for (const block of blocks) {
    const get = (tag) => {
      const m = block.match(new RegExp("<" + tag + "[^>]*>([^<]*)</" + tag + ">"));
      return m ? m[1].trim() : "";
    };

    const lastName = get("last_name");
    const firstName = get("first_name");
    const party = get("party");
    const state = get("state");
    const phone = get("phone");
    const website = get("website");
    const email = get("email");
    const memberClass = get("class");
    const bioguideId = get("bioguide_id");

    if (!lastName || !state || !bioguideId) continue;

    members.push({
      bioguide_id: bioguideId,
      name: (firstName + " " + lastName).trim(),
      party, state,
      class: memberClass || "",
      phone: phone || "",
      website: website || "",
      // The feed's <email> tag is actually each senator's contact/feedback
      // URL (not a mailto address), the same role contact_url plays for
      // representatives.
      contact_url: email || website || "",
    });
  }
  return members;
}
