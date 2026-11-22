// =============================================================================
// api/seo.js - server-rendered public pages, the sitemap, and IndexNow.
//
// The app itself is a single page tool that search engines see as an empty
// shell. This function gives the public record real, crawlable addresses:
//
//   /congress               every sitting member, by state and A to Z
//   /congress/:state        one state's delegation        (/congress/colorado)
//   /rep/:slug              one member's public record    (/rep/lauren-boebert-b000825)
//   /bills                  bills with plain-language breakdowns
//   /bill/:id               one bill                      (/bill/hr-7730-119)
//   /sitemap.xml            generated from the database, always current
//   /api/seo?op=indexnow    tells Bing, DuckDuckGo, Yandex and friends what changed
//
// vercel.json rewrites those paths here. Pages are complete HTML (title,
// description, canonical, social tags, structured data) and cache at the
// edge, so crawlers and people both get them fast. See api/_seo/pages.js for
// the accuracy rules. House style: no em dashes or en dashes anywhere.
// =============================================================================
import { sql, hasDb } from "./_db.js";
import { notFound } from "./_seo/layout.js";
import {
  congressIndex, statePage, loadMember, memberPage, billsIndex, billPage, urlInventory,
} from "./_seo/pages.js";
import { ORIGIN, memberPath, stateFromSlug, statePath, parseBillId, billPath, esc } from "./_seo/util.js";

// IndexNow ownership key. Public by design: the same value is served at
// /<key>.txt (public/) so search engines can confirm the site sent the ping.
const INDEXNOW_KEY = "33c5eeb6223427f5c9b7ad0bdf00cd28";

const PAGE_CACHE = "public, max-age=0, s-maxage=21600, stale-while-revalidate=604800";

function html(res, status, body, cache = PAGE_CACHE) {
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.setHeader("Cache-Control", status === 200 ? cache : "public, max-age=0, s-maxage=300");
  return res.status(status).send(body);
}

function redirect(res, to) {
  res.setHeader("Location", to);
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=86400");
  return res.status(308).send("");
}

export default async function handler(req, res) {
  const op = String(req.query.op || "");
  if (!hasDb) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(503).send("Database not configured");
  }

  try {
    if (op === "sitemap") return await sitemap(res);
    if (op === "indexnow") return await indexNow(req, res);

    if (op === "congress") {
      const out = await congressIndex();
      return out ? html(res, 200, out) : html(res, 404, notFound());
    }

    if (op === "state") {
      const code = stateFromSlug(req.query.state);
      if (!code) return html(res, 404, notFound("That state is not on file."));
      // /congress/co and /congress/CO both land on /congress/colorado.
      if (String(req.query.state) !== statePath(code).split("/").pop()) return redirect(res, statePath(code));
      const out = await statePage(code);
      return out ? html(res, 200, out) : html(res, 404, notFound("No members on file for that state."));
    }

    if (op === "member") {
      // The bioguide id is the last 7 characters of the slug; the name part
      // is for people and search engines. A bare id or a stale name
      // redirects to the current address.
      const slug = String(req.query.slug || "");
      const m = slug.match(/([A-Za-z]\d{6})$/);
      if (!m) return html(res, 404, notFound("That member is not on file."));
      const member = await loadMember(m[1].toUpperCase());
      if (!member) return html(res, 404, notFound("That member is not currently serving, or the link is out of date."));
      const canonical = memberPath(member);
      if (`/rep/${slug}` !== canonical) return redirect(res, canonical);
      return html(res, 200, await memberPage(member));
    }

    if (op === "bills") return html(res, 200, await billsIndex());

    if (op === "bill") {
      const ref = parseBillId(req.query.id);
      if (!ref) return html(res, 404, notFound("That bill number does not look right."));
      if (String(req.query.id) !== ref.id) return redirect(res, billPath(ref.id));
      const out = await billPage(ref);
      return out ? html(res, 200, out.html) : html(res, 404, notFound("That bill is not on file."));
    }

    return html(res, 404, notFound());
  } catch (err) {
    console.error("seo:", op, err);
    res.setHeader("Cache-Control", "no-store");
    res.setHeader("Content-Type", "text/html; charset=utf-8");
    return res.status(500).send(notFound("The record could not be loaded just now. Please try again in a minute."));
  }
}

// ---------- sitemap ----------

async function sitemap(res) {
  const urls = await urlInventory();
  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((u) => `<url><loc>${esc(u.loc)}</loc>${u.lastmod ? `<lastmod>${u.lastmod}</lastmod>` : ""}<changefreq>${u.changefreq}</changefreq><priority>${u.priority}</priority></url>`).join("\n")}
</urlset>`;
  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=0, s-maxage=3600, stale-while-revalidate=86400");
  return res.status(200).send(body);
}

// ---------- IndexNow ----------
// One POST tells every participating engine (Bing, DuckDuckGo, Yandex, Seznam,
// Naver, Yep) which addresses are new or changed. The first run sends the
// whole site; later runs send only pages modified since the last run. A
// 6 hour floor between runs makes the open endpoint harmless to poke at.
async function indexNow(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const STATE_KEY = "seo_indexnow_last";
  const MIN_GAP_MS = 6 * 3600 * 1000;

  let last = null;
  try {
    const r = await sql`SELECT value FROM rs_state WHERE key = ${STATE_KEY}`;
    if (r.length) last = r[0].value;
  } catch { /* table absent: treat as a first run */ }

  if (last && Date.now() - new Date(last).getTime() < MIN_GAP_MS) {
    return res.status(200).json({ ok: true, skipped: "ran_recently", last });
  }

  const all = await urlInventory();
  const sinceDay = last ? String(last).slice(0, 10) : null;
  const changed = sinceDay ? all.filter((u) => !u.lastmod || u.lastmod >= sinceDay) : all;
  const urlList = changed.map((u) => u.loc).slice(0, 10000);

  const r = await fetch("https://api.indexnow.org/indexnow", {
    method: "POST",
    headers: { "Content-Type": "application/json; charset=utf-8" },
    body: JSON.stringify({
      host: new URL(ORIGIN).host,
      key: INDEXNOW_KEY,
      keyLocation: `${ORIGIN}/${INDEXNOW_KEY}.txt`,
      urlList,
    }),
  });

  // 200 and 202 both mean accepted (202 = key validation still pending).
  const accepted = r.status === 200 || r.status === 202;
  if (accepted) {
    const now = new Date().toISOString();
    try {
      await sql`
        INSERT INTO rs_state (key, value, updated_at) VALUES (${STATE_KEY}, ${now}, now())
        ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`;
    } catch { /* best effort */ }
  }
  return res.status(accepted ? 200 : 502).json({
    ok: accepted, indexnowStatus: r.status, submitted: urlList.length, firstRun: !last,
  });
}
