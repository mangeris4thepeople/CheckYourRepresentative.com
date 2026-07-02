// =============================================================================
// /api/sync-reps.js - fetch all House members from clerk.house.gov XML
// and store them in the representatives table
// Usage: GET /api/sync-reps
// =============================================================================
import { sql } from "./_db.js";

export default async function handler(req, res) {
  try {
    const r = await fetch("https://clerk.house.gov/xml/lists/MemberData.xml", {
      headers: { "User-Agent": "CheckYourRepresentative/1.0 (checkyourrepresentative.com)" }
    });
    if (!r.ok) throw new Error("clerk.house.gov returned " + r.status);

    const xml = await r.text();
    const members = parseXML(xml);

    await sql`
      CREATE TABLE IF NOT EXISTS representatives (
        district    TEXT PRIMARY KEY,
        name        TEXT,
        party       TEXT,
        state       TEXT,
        phone       TEXT,
        website     TEXT,
        contact_url TEXT,
        updated_at  TIMESTAMPTZ DEFAULT now()
      )
    `;

    let count = 0;
    for (const m of members) {
      await sql`
        INSERT INTO representatives (district, name, party, state, phone, website, contact_url)
        VALUES (${m.district}, ${m.name}, ${m.party}, ${m.state}, ${m.phone}, ${m.website}, ${m.contact_url})
        ON CONFLICT (district) DO UPDATE SET
          name = EXCLUDED.name, party = EXCLUDED.party,
          phone = EXCLUDED.phone, website = EXCLUDED.website,
          contact_url = EXCLUDED.contact_url,
          updated_at = now()
      `;
      count++;
    }

    return res.status(200).json({ ok: true, synced: count, sample: members.slice(0,3) });
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
    const getAttr = (tag, attr) => {
      const m = block.match(new RegExp("<" + tag + '[^>]*' + attr + '="([^"]*)"'));
      return m ? m[1].trim() : "";
    };

    const lastname  = get("lastname");
    const firstname = get("firstname");
    const party     = get("party");
    const phone     = get("phone");
    const distText  = get("district");
    const state     = getAttr("state", "postal-code");

    if (!lastname || !state) continue;

    let distCode;
    if (/at large|delegate|resident/i.test(distText)) {
      distCode = state + "-AL";
    } else {
      const num = parseInt(distText.replace(/[^0-9]/g, ""));
      distCode = isNaN(num) ? state + "-AL" : state + "-" + String(num).padStart(2, "0");
    }

    const cleanLast = lastname.toLowerCase()
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z]/g, "");
    const website = "https://" + cleanLast + ".house.gov";

    members.push({
      district: distCode,
      name: (firstname + " " + lastname).trim(),
      party, state,
      phone: phone || "",
      website,
      contact_url: website + "/contact",
    });
  }
  return members;
}
