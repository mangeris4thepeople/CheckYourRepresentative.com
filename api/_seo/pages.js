// =============================================================================
// api/_seo/pages.js - data loading and HTML for the server-rendered public
// pages: the Congress directory, state delegations, member profiles, the
// bills index, and individual bill pages.
//
// Accuracy rules for everything printed here:
//   - Every number comes straight from a table the app already shows, and
//     is labeled with what it covers (session, cycle, "through" date).
//   - Nothing is inferred about a member. No grades, no scores, no
//     characterizations. The record and its source link, nothing else.
//   - Bill status always comes from the bills table (Congress.gov, synced
//     daily), never from a cached summary, which can be older.
//   - The plain-language bill summaries are AI-written and say so.
//
// House style: no em dashes or en dashes anywhere.
// =============================================================================
import { sql } from "../_db.js";
import { page } from "./layout.js";
import {
  ORIGIN, SITE, STATES, esc, clean, clip, kebab, money, num, pct, fmtDate, isoDate, yearOf,
  memberPath, memberSlug, memberTag, statePath, stateSlug, billPath, partyLetter, honorific,
  roleLine, seatLabel, billLabel, billKind, congressGovBillUrl, ordinal,
} from "./util.js";

const SESSION_LABEL = "2026 session of the 119th Congress";

// ---------- small render helpers ----------

function tag(m) { const p = partyLetter(m.party); return `<span class="tag ${p}">${esc(memberTag(m))}</span>`; }

function memberCard(m) {
  const att = pct(m.votes_cast, m.votes_total);
  const bits = [seatLabel(m), m.first_term_start ? `First took office ${yearOf(m.first_term_start)}` : null,
    att != null ? `${att}% of votes cast` : null].filter(Boolean);
  return `<a class="mcard" href="${memberPath(m)}">
<img src="${esc(m.photo_url || "/icons/mark-96.png")}" alt="${esc(m.full_name)}" width="54" height="66" loading="lazy">
<span><b>${esc(m.full_name)} ${tag(m)}</b><span>${esc(bits.join(" · "))}</span></span></a>`;
}

function possessive(name) { return /s$/i.test(name) ? `${name}'` : `${name}'s`; }

// "a U.S. Senator for Colorado" (one of two) but "the U.S. Representative for
// Colorado's 4th Congressional District" (the only one).
function roleWithArticle(m) { return `${m.chamber === "senate" ? "a" : "the"} ${roleLine(m)}`; }

function partyNoun(p) { return /^ind/i.test(p || "") ? `an ${p}` : `a ${p}`; }

function partyOrg(p) {
  if (/^dem/i.test(p || "")) return "Democratic Party";
  if (/^rep/i.test(p || "")) return "Republican Party";
  return null;
}

function byLastName(a, b) {
  return String(a.last_name || "").localeCompare(String(b.last_name || "")) ||
    String(a.first_name || "").localeCompare(String(b.first_name || ""));
}

function districtOrder(a, b) {
  return String(a.district || "").localeCompare(String(b.district || ""), "en", { numeric: true });
}

function cta(title, text, primaryHref, primaryLabel, secondHref, secondLabel) {
  return `<div class="cta"><div><strong>${esc(title)}</strong><p>${esc(text)}</p></div>
<div class="hero-actions" style="margin:0"><a class="btn btn-primary" href="${primaryHref}">${esc(primaryLabel)} <span aria-hidden="true">→</span></a>${
    secondHref ? `<a class="btn btn-ghost" href="${secondHref}">${esc(secondLabel)}</a>` : ""}</div></div>`;
}

// =============================================================================
// /congress - the full directory
// =============================================================================
export async function congressIndex() {
  const members = await sql`
    SELECT bioguide_id, full_name, first_name, last_name, chamber, state, district, party
    FROM rs_members WHERE active`;
  if (!members.length) return null;

  const senators = members.filter((m) => m.chamber === "senate").length;
  const house = members.length - senators;
  const byState = {};
  for (const m of members) (byState[m.state] ||= []).push(m);
  const codes = Object.keys(byState).filter((c) => STATES[c])
    .sort((a, b) => STATES[a].localeCompare(STATES[b]));

  const stateChips = codes.map((c) =>
    `<a href="${statePath(c)}">${esc(STATES[c])} <span class="meta">(${byState[c].length})</span></a>`).join("");

  const az = [...members].sort(byLastName).map((m) =>
    `<li><a href="${memberPath(m)}">${esc(m.last_name)}, ${esc(m.first_name)}</a> <span class="meta">${esc(memberTag(m))}</span></li>`).join("");

  const title = `Find Your Member of Congress: All ${members.length} Senators and Representatives | ${SITE}`;
  const description = `Every current member of Congress in one place: ${senators} senators and ${house} House members. Open any name for attendance, campaign money, donors, committees and sponsored bills, all from public records.`;

  return page({
    title, description, path: "/congress", active: "congress",
    crumbs: [["Home", "/"], ["Congress", "/congress"]],
    schema: [{
      "@context": "https://schema.org", "@type": "CollectionPage",
      name: "Members of the United States Congress", url: `${ORIGIN}/congress`, description,
      isPartOf: { "@type": "WebSite", name: SITE, url: ORIGIN },
    }],
    hero: `<p class="kicker">119th Congress</p>
<h1>Find your member of Congress</h1>
<p class="lede">${num(members.length)} sitting members: ${senators} senators and ${house} House members, including delegates. Pick a state or a name to see attendance, campaign money, donors, committees and sponsored bills. Every figure links to its public source.</p>
<div class="hero-actions"><a class="btn btn-gold" href="/">Look up my district by address</a><a class="btn btn-light" href="/bills">Bills in Congress</a></div>`,
    body: `<section class="card"><h2>Browse by state</h2><p class="sub">${codes.length} states and territories send members to Congress.</p><div class="chips">${stateChips}</div></section>
<section class="card"><h2>Every member, A to Z</h2><p class="sub">Listed by last name with party and seat.</p><ul class="az">${az}</ul></section>
${cta("Do not know your district?", "Enter your address in the tool and it finds your representative and both senators.", "/", "Find my representative", "/how-it-works", "How it works")}`,
  });
}

// =============================================================================
// /congress/:state - one delegation
// =============================================================================
export async function statePage(code) {
  const name = STATES[code];
  if (!name) return null;
  const members = await sql`
    SELECT m.bioguide_id, m.full_name, m.first_name, m.last_name, m.chamber, m.state, m.district,
           m.party, m.first_term_start, m.photo_url, s.votes_total, s.votes_cast
    FROM rs_members m LEFT JOIN rs_stats s ON s.bioguide_id = m.bioguide_id
    WHERE m.active AND m.state = ${code}`;
  if (!members.length) return null;

  const sens = members.filter((m) => m.chamber === "senate").sort(byLastName);
  const reps = members.filter((m) => m.chamber !== "senate").sort(districtOrder);
  const isState = sens.length > 0;

  const parts = [];
  if (sens.length) parts.push(`${sens.length} ${sens.length === 1 ? "senator" : "senators"}`);
  if (reps.length) parts.push(`${reps.length} House ${reps.length === 1 ? "member" : "members"}`);
  const title = `${name} Members of Congress: ${isState ? "Senators and Representatives" : "House Member"} | ${SITE}`;
  const description = clip(`${possessive(name)} delegation in the 119th Congress: ${parts.join(" and ")}. ${members.slice().sort(byLastName).slice(0, 6).map((m) => m.full_name).join(", ")}${members.length > 6 ? " and more" : ""}. Attendance, campaign money and donors from public records.`, 200);

  const path = statePath(code);
  return page({
    title, description, path, active: "congress",
    crumbs: [["Home", "/"], ["Congress", "/congress"], [name, path]],
    schema: [{
      "@context": "https://schema.org", "@type": "ItemList",
      name: `${name} members of Congress`, numberOfItems: members.length,
      itemListElement: [...sens, ...reps].map((m, i) => ({
        "@type": "ListItem", position: i + 1, name: m.full_name, url: ORIGIN + memberPath(m),
      })),
    }],
    hero: `<p class="kicker">119th Congress</p>
<h1>${esc(name)} in Congress</h1>
<p class="lede">${esc(possessive(name))} delegation: ${esc(parts.join(" and "))}. Open any member for attendance, campaign money, donors, committees and sponsored bills.</p>
<div class="hero-actions"><a class="btn btn-gold" href="/">Find my district by address</a><a class="btn btn-light" href="/congress">All states</a></div>`,
    body: `${sens.length ? `<section class="card"><h2>U.S. Senators for ${esc(name)}</h2><p class="sub">Senators represent the whole state.</p><div class="grid g2">${sens.map(memberCard).join("")}</div></section>` : ""}
${reps.length ? `<section class="card"><h2>${isState ? `U.S. Representatives for ${esc(name)}` : `${esc(name)} in the U.S. House`}</h2><p class="sub">${isState ? "One member per congressional district." : "Territories and the District of Columbia send one non-voting member to the House."}</p><div class="grid g2">${reps.map(memberCard).join("")}</div></section>` : ""}
<p class="note">Attendance shows roll call votes on file here for the ${SESSION_LABEL}. Sources: Congress.gov, the Clerk of the House and Senate.gov.</p>
${cta(`Live in ${name}?`, "Enter your address to confirm your district, then put your own position on the bills your members are voting on.", "/", "Find my representative", "/vote", "Vote on bills")}`,
  });
}

// =============================================================================
// /rep/:slug - one member
// =============================================================================
export async function loadMember(bioguide) {
  const rows = await sql`
    SELECT bioguide_id, full_name, first_name, last_name, chamber, state, district, party,
           first_term_start, term_start, term_end, phone, website, contact_form, photo_url, synced_at
    FROM rs_members WHERE bioguide_id = ${bioguide} AND active`;
  return rows[0] || null;
}

export async function memberPage(m) {
  const bio = m.bioguide_id;
  const safe = (p) => p.catch(() => []);
  const financeQ = m.chamber === "senate"
    ? sql`SELECT s.fec_candidate_id, t.cycle, t.receipts, t.disbursements, t.individual_contributions,
                 t.pac_contributions, t.cash_on_hand_end
          FROM senators s JOIN senator_finance_totals t ON t.fec_candidate_id = s.fec_candidate_id
          WHERE s.bioguide_id = ${bio} ORDER BY t.cycle DESC LIMIT 4`
    : sql`SELECT r.fec_candidate_id, t.cycle, t.receipts, t.disbursements, t.individual_contributions,
                 t.pac_contributions, t.cash_on_hand_end
          FROM representatives r JOIN rep_fec_totals t ON t.fec_candidate_id = r.fec_candidate_id
          WHERE r.district = ${m.district || ""} ORDER BY t.cycle DESC LIMIT 4`;

  const [statsRows, totals, donors, committees, bills, delegation] = await Promise.all([
    safe(sql`SELECT congress, votes_total, votes_cast, votes_missed, yes_votes, no_votes, present_votes,
                    last_vote_date, sponsored_total, updated_at
             FROM rs_stats WHERE bioguide_id = ${bio}`),
    safe(financeQ),
    safe(sql`SELECT cycle, bucket_type, bucket_label, total_amount, donor_count, source_url
             FROM rs_top_donors
             WHERE bioguide_id = ${bio}
               AND cycle = (SELECT max(cycle) FROM rs_top_donors WHERE bioguide_id = ${bio})
             ORDER BY total_amount DESC`),
    safe(sql`SELECT committee_name, subcommittee, role, rank FROM rs_committees
             WHERE bioguide_id = ${bio} ORDER BY committee_name, rank NULLS LAST`),
    safe(sql`SELECT posted_at, title, body, source_url FROM rs_wall_posts
             WHERE bioguide_id = ${bio} AND kind = 'sponsored-bill'
             ORDER BY posted_at DESC NULLS LAST LIMIT 6`),
    safe(sql`SELECT m.bioguide_id, m.full_name, m.first_name, m.last_name, m.chamber, m.state,
                    m.district, m.party, m.first_term_start, m.photo_url, s.votes_total, s.votes_cast
             FROM rs_members m LEFT JOIN rs_stats s ON s.bioguide_id = m.bioguide_id
             WHERE m.active AND m.state = ${m.state} AND m.bioguide_id <> ${bio}`),
  ]);

  const stats = statsRows[0] && Number(statsRows[0].votes_total) > 0 ? statsRows[0] : null;
  const name = m.full_name;
  const stName = STATES[m.state] || m.state;
  const role = roleLine(m);
  const hon = honorific(m);
  const tagText = memberTag(m);
  const path = memberPath(m);
  const att = stats ? pct(stats.votes_cast, stats.votes_total) : null;
  const latest = totals[0] || null;
  // The FEC row can exist with amounts not yet filed. Unknown is not $0.
  const hasReceipts = !!latest && latest.receipts != null;
  const moneyCell = (v) => money(v) || "Not reported";
  const fecId = latest?.fec_candidate_id || null;
  const fecUrl = fecId ? `https://www.fec.gov/data/candidate/${encodeURIComponent(fecId)}/` : "https://www.fec.gov/data/";
  const bioguideUrl = `https://bioguide.congress.gov/search/bio/${bio}`;
  const congressUrl = `https://www.congress.gov/member/${kebab(name)}/${bio}`;

  // ---- committees: group subcommittees under their parent ----
  const commMap = new Map();
  for (const c of committees) {
    const key = c.committee_name;
    if (!key) continue;
    if (!commMap.has(key)) commMap.set(key, { name: key, role: null, subs: [] });
    const g = commMap.get(key);
    if (c.subcommittee) g.subs.push(c.role ? `${c.subcommittee} (${c.role})` : c.subcommittee);
    else if (c.role) g.role = c.role;
  }
  const comms = [...commMap.values()];

  // ---- donors ----
  const donorCycle = donors[0]?.cycle || null;
  const donorSource = donors.find((d) => d.source_url)?.source_url || fecUrl;
  const bySize = donors.filter((d) => d.bucket_type === "size");
  const byState = donors.filter((d) => d.bucket_type === "state").slice(0, 8);

  // ---- description and title ----
  const descBits = [`${hon} ${name} (${tagText}) is ${roleWithArticle(m)}`];
  if (m.first_term_start) descBits[0] += `, first sworn in to Congress in ${yearOf(m.first_term_start)}`;
  descBits[0] += ".";
  if (stats) descBits.push(`Cast ${num(stats.votes_cast)} of ${num(stats.votes_total)} roll call votes on file for 2026 (${att}%).`);
  if (hasReceipts) descBits.push(`${latest.cycle} cycle receipts: ${money(latest.receipts)}.`);
  descBits.push("Donors, committees and sponsored bills from public records.");
  const description = clip(descBits.join(" "), 230);
  const title = `${name}: Voting Record, Donors and Attendance (${tagText}) | ${SITE}`;

  // ---- FAQ (visible on the page and mirrored in structured data) ----
  const faq = [];
  faq.push([`Who is ${name}?`,
    `${name} is ${partyNoun(m.party)} serving as ${roleWithArticle(m)}.` +
    (m.first_term_start ? ` ${name} first took office in Congress on ${fmtDate(m.first_term_start)}.` : "") +
    (m.term_end ? ` The current term ends on ${fmtDate(m.term_end)}.` : "")]);
  if (stats) {
    faq.push([`How often does ${name} vote?`,
      `In the ${SESSION_LABEL}, ${name} cast ${num(stats.votes_cast)} of the ${num(stats.votes_total)} roll call votes on file here and missed ${num(stats.votes_missed)}, a participation rate of ${att}%.` +
      (stats.last_vote_date ? ` This count runs through ${fmtDate(stats.last_vote_date)}.` : "")]);
  }
  if (hasReceipts) {
    const from = [];
    if (latest.individual_contributions != null) from.push(`${money(latest.individual_contributions)} from individual contributors`);
    if (latest.pac_contributions != null) from.push(`${money(latest.pac_contributions)} from PACs and other committees`);
    faq.push([`How much money has ${possessive(name)} campaign raised?`,
      `Federal Election Commission filings for the ${latest.cycle} cycle show total receipts of ${money(latest.receipts)}` +
      (from.length ? `, including ${from.join(" and ")}` : "") + "." +
      (latest.cash_on_hand_end != null ? ` Ending cash on hand for that cycle is ${money(latest.cash_on_hand_end)}.` : "")]);
  }
  if (comms.length) {
    faq.push([`What committees does ${name} serve on?`,
      `${name} serves on ${comms.map((c) => c.role ? `the ${c.name} (${c.role})` : `the ${c.name}`).join("; ")}.`]);
  }
  if (m.phone || m.website) {
    faq.push([`How do I contact ${name}?`,
      [m.phone ? `The Washington office phone number is ${m.phone}.` : "",
        m.website ? `The official website is ${m.website}.` : ""].filter(Boolean).join(" ")]);
  }

  // ---- structured data ----
  const sameAs = [m.website, bioguideUrl, congressUrl, fecId ? fecUrl : null].filter(Boolean);
  const person = {
    "@type": "Person", "@id": `${ORIGIN}${path}#person`,
    name, givenName: m.first_name || undefined, familyName: m.last_name || undefined,
    jobTitle: role, image: m.photo_url || undefined, url: ORIGIN + path, sameAs,
    affiliation: partyOrg(m.party) ? { "@type": "Organization", name: partyOrg(m.party) } : undefined,
    worksFor: {
      "@type": "GovernmentOrganization",
      name: m.chamber === "senate" ? "United States Senate" : "United States House of Representatives",
    },
    telephone: m.phone || undefined,
  };
  const modified = isoDate(stats?.updated_at) || isoDate(m.synced_at);
  const schema = [{
    "@context": "https://schema.org", "@type": "ProfilePage",
    url: ORIGIN + path, name: title, description, dateModified: modified || undefined,
    isPartOf: { "@type": "WebSite", name: SITE, url: ORIGIN },
    mainEntity: person,
  }, {
    "@context": "https://schema.org", "@type": "FAQPage",
    mainEntity: faq.map(([q, a]) => ({
      "@type": "Question", name: q, acceptedAnswer: { "@type": "Answer", text: a },
    })),
  }];

  // ---- hero ----
  const pills = [
    `<span class="pill">${esc(m.party)}</span>`,
    m.first_term_start ? `<span class="pill">First took office ${yearOf(m.first_term_start)}</span>` : "",
    m.term_end ? `<span class="pill">Term ends ${esc(fmtDate(m.term_end))}</span>` : "",
  ].join("");
  const hero = `<div class="who">
${m.photo_url ? `<img src="${esc(m.photo_url)}" alt="Official portrait of ${esc(name)}" width="132" height="161">` : ""}
<div style="min-width:0;flex:1 1 320px">
<p class="kicker">${esc(m.chamber === "senate" ? "United States Senate" : "U.S. House of Representatives")} · ${esc(stName)}</p>
<h1>${esc(name)}</h1>
<p class="lede">${esc(role)}</p>
<div class="pills">${pills}</div>
<div class="hero-actions">
<a class="btn btn-gold" href="/report-card/${bio}">Open the full report card</a>
<a class="btn btn-light" href="/vote">Tell ${esc(hon)} ${esc(m.last_name)} where you stand</a>
</div></div></div>`;

  // ---- body sections ----
  const statCards = stats ? `<div class="grid g4">
<div class="card stat"><b>${att}%</b><span>Votes cast</span><div class="bar"><i style="width:${Math.max(0, Math.min(100, att))}%"></i></div></div>
<div class="card stat"><b>${num(stats.votes_cast)}</b><span>Of ${num(stats.votes_total)} roll calls</span><small>${num(stats.votes_missed)} missed</small></div>
<div class="card stat"><b>${num(stats.yes_votes)}</b><span>Yes votes</span><small>${num(stats.no_votes)} no${Number(stats.present_votes) > 0 ? `, ${num(stats.present_votes)} present` : ""}</small></div>
<div class="card stat"><b>${hasReceipts ? esc(money(latest.receipts)) : (m.first_term_start ? yearOf(m.first_term_start) : "")}</b><span>${hasReceipts ? `${latest.cycle} cycle receipts` : (m.first_term_start ? "First took office" : "")}</span>${hasReceipts ? "<small>FEC filings</small>" : ""}</div>
</div>` : "";

  const record = stats ? `<section class="card"><h2>${esc(possessive(name))} voting attendance</h2>
<p class="sub">Roll call votes on file here for the ${SESSION_LABEL}${stats.last_vote_date ? `, through ${esc(fmtDate(stats.last_vote_date))}` : ""}.</p>
<div class="prose"><p>${esc(hon)} ${esc(m.last_name)} cast <strong>${num(stats.votes_cast)}</strong> of <strong>${num(stats.votes_total)}</strong> recorded votes, a participation rate of <strong>${att}%</strong>, and missed ${num(stats.votes_missed)}. Of the votes cast, ${num(stats.yes_votes)} were yes and ${num(stats.no_votes)} were no${Number(stats.present_votes) > 0 ? `, with ${num(stats.present_votes)} recorded as present` : ""}.</p></div>
<p class="src">Source: ${m.chamber === "senate" ? `<a href="https://www.senate.gov/legislative/votes_new.htm" rel="noopener">Senate.gov roll call votes</a>` : `<a href="https://clerk.house.gov/Votes" rel="noopener">Clerk of the House roll call votes</a> via Congress.gov`}. <a href="/roll-calls">See every roll call with every name attached</a>.</p></section>` : "";

  const moneySection = totals.length ? `<section class="card"><h2>Campaign money</h2>
<p class="sub">Totals on file with the Federal Election Commission for ${esc(possessive(name))} campaign, by two-year cycle.</p>
<div class="scroll"><table><thead><tr><th>Cycle</th><th class="n">Receipts</th><th class="n">Spent</th><th class="n">From individuals</th><th class="n">From PACs</th><th class="n">Cash on hand</th></tr></thead><tbody>
${totals.map((t) => `<tr><td><strong>${t.cycle}</strong></td><td class="n">${esc(moneyCell(t.receipts))}</td><td class="n">${esc(moneyCell(t.disbursements))}</td><td class="n">${esc(moneyCell(t.individual_contributions))}</td><td class="n">${esc(moneyCell(t.pac_contributions))}</td><td class="n">${esc(moneyCell(t.cash_on_hand_end))}</td></tr>`).join("")}
</tbody></table></div>
<p class="src">Source: <a href="${esc(fecUrl)}" rel="noopener">FEC candidate filings${fecId ? ` (${esc(fecId)})` : ""}</a>. <a href="/follow-the-money">Follow the money in the tool</a>.</p></section>` : "";

  const donorTable = (rows, head) => `<div class="scroll"><table><thead><tr><th>${head}</th><th class="n">Amount</th><th class="n">Donors</th></tr></thead><tbody>
${rows.map((d) => `<tr><td>${esc(d.bucket_type === "state" ? (STATES[d.bucket_label] || d.bucket_label) : d.bucket_label)}</td><td class="n">${esc(moneyCell(d.total_amount))}</td><td class="n">${d.donor_count != null ? num(d.donor_count) : ""}</td></tr>`).join("")}
</tbody></table></div>`;
  const donorSection = (bySize.length || byState.length) ? `<section class="card"><h2>Where the money comes from</h2>
<p class="sub">The FEC's own breakdown of individual contributions for the ${esc(donorCycle)} cycle.</p>
<div class="grid g2">
${bySize.length ? `<div><h3 style="margin-top:0">By contribution size</h3>${donorTable(bySize, "Size of gift")}</div>` : ""}
${byState.length ? `<div><h3 style="margin-top:0">By donor state${byState.length > 1 ? ` (top ${byState.length})` : ""}</h3>${donorTable(byState, "State")}</div>` : ""}
</div>
<p class="src">Source: <a href="${esc(donorSource)}" rel="noopener">FEC itemized and unitemized receipts</a>.</p></section>` : "";

  const commSection = comms.length ? `<section class="card"><h2>Committee assignments</h2>
<p class="sub">Where ${esc(hon)} ${esc(m.last_name)} sits in the 119th Congress.</p>
<ul class="list">${comms.map((c) => `<li><strong>${esc(c.name)}</strong>${c.role ? ` <span class="meta">(${esc(c.role)})</span>` : ""}${c.subs.length ? `<div class="meta">Subcommittees: ${esc(c.subs.join("; "))}</div>` : ""}</li>`).join("")}</ul></section>` : "";

  const billSection = bills.length ? `<section class="card"><h2>Bills ${esc(name)} sponsored recently</h2>
<p class="sub">${stats?.sponsored_total ? `${num(stats.sponsored_total)} bills and resolutions sponsored on record at Congress.gov. The most recent:` : "The most recent bills and resolutions on record at Congress.gov."}</p>
<ul class="list">${bills.map((b) => `<li><a href="${esc(b.source_url)}" rel="noopener"><strong>${esc(clean(b.body || b.title))}</strong></a><div class="meta">${esc(clean(b.title))}${b.posted_at ? ` · ${esc(fmtDate(b.posted_at))}` : ""}</div></li>`).join("")}</ul>
<p class="src">Source: <a href="${esc(congressUrl)}" rel="noopener">Congress.gov member record</a>. Titles are printed exactly as filed.</p></section>` : "";

  const contact = (m.phone || m.website) ? `<section class="card"><h2>Contact ${esc(hon)} ${esc(m.last_name)}</h2>
<ul class="list">
${m.phone ? `<li><strong>Washington office:</strong> <a href="tel:${esc(String(m.phone).replace(/[^0-9+]/g, ""))}">${esc(m.phone)}</a></li>` : ""}
${m.website ? `<li><strong>Official website:</strong> <a href="${esc(m.website)}" rel="noopener">${esc(String(m.website).replace(/^https?:\/\//, ""))}</a></li>` : ""}
${m.contact_form ? `<li><strong>Contact form:</strong> <a href="${esc(m.contact_form)}" rel="noopener">Send a message</a></li>` : ""}
<li><strong>Official biography:</strong> <a href="${esc(bioguideUrl)}" rel="noopener">Biographical Directory of the U.S. Congress</a></li>
</ul></section>` : "";

  const faqSection = `<section class="card"><h2>Questions people ask about ${esc(name)}</h2>
<dl class="faq">${faq.map(([q, a]) => `<dt>${esc(q)}</dt><dd>${esc(a)}</dd>`).join("")}</dl></section>`;

  const sens = delegation.filter((d) => d.chamber === "senate").sort(byLastName);
  const reps = delegation.filter((d) => d.chamber !== "senate").sort(districtOrder);
  const others = [...sens, ...reps];
  const more = others.length ? `<section class="card"><h2>More members from ${esc(stName)}</h2>
<p class="sub"><a href="${statePath(m.state)}">See the full ${esc(stName)} delegation</a></p>
<div class="grid g3">${others.slice(0, 12).map(memberCard).join("")}</div>
${others.length > 12 ? `<p class="src"><a href="${statePath(m.state)}">All ${others.length + 1} members from ${esc(stName)}</a></p>` : ""}</section>` : "";

  return page({
    title, description, path, active: "congress", ogType: "profile",
    crumbs: [["Home", "/"], ["Congress", "/congress"], [stName, statePath(m.state)], [name, path]],
    schema, hero,
    body: `${statCards}${record}${moneySection}${donorSection}${commSection}${billSection}${contact}${faqSection}${more}
${cta(`Does ${hon} ${m.last_name} vote the way you would?`, "Read the bills in plain language, record your own position, and compare it with the roll call when the vote happens.", "/vote", "Vote on bills", `/know-your-rep/repspace/${bio}`, "RepSpace profile")}`,
  });
}

// =============================================================================
// /bills - index of bills with plain-language summaries
// =============================================================================
async function summarizedBills() {
  const rows = await sql`
    SELECT DISTINCT ON (b.id) b.id, b.type, b.number, b.congress, b.title, b.latest_action,
           b.action_date, s.headline, s.generated_at
    FROM bills b JOIN bill_summaries s ON s.bill_id = b.id
    WHERE s.cache_key LIKE 'v2:%'
    ORDER BY b.id, s.generated_at DESC`;
  return rows.sort((a, b) => String(isoDate(b.action_date) || "").localeCompare(String(isoDate(a.action_date) || "")));
}

export async function billsIndex() {
  const [rows, countRows] = await Promise.all([
    summarizedBills(),
    sql`SELECT count(*)::int AS n FROM bills WHERE is_active`.catch(() => [{ n: null }]),
  ]);
  const total = countRows[0]?.n;
  const title = `Bills in Congress, Explained in Plain English (119th Congress) | ${SITE}`;
  const description = `Plain-language breakdowns of ${rows.length} bills moving through the 119th Congress: what each one does, who it affects, and where it stands. Read one, then put your own position on the record.`;

  const items = rows.map((b) => `<li><a href="${billPath(b.id)}"><strong>${esc(clean(b.headline && b.headline !== "letter" ? b.headline : b.title))}</strong></a>
<div class="meta">${esc(billLabel(b))} · ${esc(clip(clean(b.title), 150))}</div>
<div class="meta">Latest action${b.action_date ? ` (${esc(fmtDate(b.action_date))})` : ""}: ${esc(clip(clean(b.latest_action), 170))}</div></li>`).join("");

  return page({
    title, description, path: "/bills", active: "bills",
    crumbs: [["Home", "/"], ["Bills", "/bills"]],
    schema: [{
      "@context": "https://schema.org", "@type": "CollectionPage", name: "Bills in the 119th Congress",
      url: `${ORIGIN}/bills`, description, isPartOf: { "@type": "WebSite", name: SITE, url: ORIGIN },
    }],
    hero: `<p class="kicker">119th Congress</p>
<h1>Bills in Congress, in plain English</h1>
<p class="lede">What each bill does, who it affects, and where it stands right now.${total ? ` The tool tracks ${num(total)} active bills; the ${rows.length} below have full plain-language breakdowns.` : ""}</p>
<div class="hero-actions"><a class="btn btn-gold" href="/vote">Vote on bills</a><a class="btn btn-light" href="/?tab=allbills">Search every active bill</a></div>`,
    body: `<section class="card"><h2>Bills with plain-language breakdowns</h2><p class="sub">Most recent action first. Status comes from Congress.gov and refreshes daily.</p><ul class="list">${items}</ul></section>
${cta("Your position belongs on the record", "Support, oppose, or undecided: cast your position before the floor vote and see how your district lines up.", "/vote", "Vote on bills", "/accountability", "Accountability Matrix")}`,
  });
}

// =============================================================================
// /bill/:id - one bill
// =============================================================================
export async function billPage(ref) {
  const rows = await sql`
    SELECT id, type, number, congress, title, policy_area, latest_action, action_date, synced_at
    FROM bills WHERE id = ${ref.id}`;
  const b = rows[0];
  if (!b) return null;

  const [sumRows, tallyRows] = await Promise.all([
    sql`SELECT headline, plain, affects, generated_at FROM bill_summaries
        WHERE bill_id = ${ref.id} AND cache_key LIKE 'v2:%'
        ORDER BY generated_at DESC LIMIT 1`.catch(() => []),
    sql`SELECT position, count(*)::int AS n FROM votes
        WHERE bill_id = ${ref.id} AND quarantined = FALSE GROUP BY position`.catch(() => []),
  ]);

  let s = null;
  if (sumRows[0]) {
    let extra = {};
    try { extra = JSON.parse(sumRows[0].plain); } catch { extra = { plain: sumRows[0].plain }; }
    s = {
      headline: clean(extra.headline || sumRows[0].headline || ""),
      plain: clean(extra.plain || ""),
      affects: clean(extra.affects || sumRows[0].affects || ""),
      sponsor: clean(extra.sponsor || ""),
      benefits: clean(extra.who_benefits || ""),
      loses: clean(extra.who_loses || ""),
      impact: clean(extra.vote_impact || ""),
      generated: sumRows[0].generated_at,
    };
    if (!s.plain) s = null;
  }

  const label = billLabel(b);
  const officialTitle = clean(b.title);
  const govUrl = congressGovBillUrl(b);
  const path = billPath(b.id);
  const headline = s?.headline || officialTitle;
  const title = clip(`${label}: ${headline}`, 78) + ` | ${SITE}`;
  const description = s
    ? clip(`${label}, ${officialTitle}. ${s.plain}`, 230)
    : clip(`${label}, ${officialTitle}. Latest action${b.action_date ? ` (${fmtDate(b.action_date)})` : ""}: ${clean(b.latest_action)}`, 230);

  const tally = { support: 0, oppose: 0, undecided: 0 };
  for (const r of tallyRows) if (r.position in tally) tally[r.position] = r.n;
  const tallyTotal = tally.support + tally.oppose + tally.undecided;

  const schema = [{
    "@context": "https://schema.org", "@type": "Legislation",
    name: officialTitle, legislationIdentifier: label, legislationType: billKind(b),
    legislationJurisdiction: { "@type": "Country", name: "United States" },
    url: ORIGIN + path, sameAs: govUrl, description,
    dateModified: isoDate(b.action_date) || undefined,
  }];

  const hero = `<p class="kicker">${esc(billKind(b))} · ${esc(ordinal(b.congress))} Congress</p>
<h1>${esc(headline)}</h1>
<p class="lede"><strong>${esc(label)}</strong>${s ? `: ${esc(officialTitle)}` : ""}</p>
<div class="hero-actions"><a class="btn btn-gold" href="/vote">Cast your position</a><a class="btn btn-light" href="${esc(govUrl)}" rel="noopener">Official text on Congress.gov</a></div>`;

  const status = `<section class="card"><h2>Where ${esc(label)} stands</h2>
<p class="sub">Latest action recorded by Congress.gov${b.action_date ? ` on ${esc(fmtDate(b.action_date))}` : ""}.</p>
<div class="prose"><p><strong>${esc(clean(b.latest_action) || "No action recorded yet.")}</strong></p></div>
${s?.sponsor ? `<p class="meta" style="margin:10px 0 0"><strong>Sponsor:</strong> ${esc(s.sponsor)}</p>` : ""}
<p class="src">Source: <a href="${esc(govUrl)}" rel="noopener">${esc(label)} on Congress.gov</a>, the official record.</p></section>`;

  const block = (h, t) => t ? `<h3>${h}</h3><div class="prose"><p>${esc(t)}</p></div>` : "";
  const summary = s ? `<section class="card"><h2>What ${esc(label)} does, in plain English</h2>
<div class="prose"><p>${esc(s.plain)}</p></div>
${block("Who it affects", s.affects)}
${block("Who benefits", s.benefits)}
${block("Who is worse off", s.loses)}
${block("What changes for most people", s.impact)}
<p class="note">This breakdown was written by an AI model from the official bill record${s.generated ? ` on ${esc(fmtDate(s.generated))}` : ""}, as a reading aid. It is not the bill text and not legal advice. The bill's current status above comes directly from Congress.gov.</p></section>` : `<section class="card"><h2>About ${esc(label)}</h2>
<div class="prose"><p>${esc(officialTitle)}</p><p>A plain-language breakdown of this bill is generated the first time someone opens it in the tool. <a href="/?tab=allbills">Open All Active Bills</a> to read it and record your position.</p></div></section>`;

  const tallySection = tallyTotal > 0 ? `<section class="card"><h2>What constituents here have said</h2>
<p class="sub">Positions recorded on this site for ${esc(label)}. This is not a scientific poll.</p>
<div class="grid g3">
<div class="card stat"><b>${num(tally.support)}</b><span>Support</span></div>
<div class="card stat"><b>${num(tally.oppose)}</b><span>Oppose</span></div>
<div class="card stat"><b>${num(tally.undecided)}</b><span>Undecided</span></div>
</div></section>` : "";

  return {
    indexable: !!s,
    html: page({
      title, description, path, active: "bills", ogType: "article",
      robots: s ? undefined : "noindex, follow",
      crumbs: [["Home", "/"], ["Bills", "/bills"], [label, path]],
      schema, hero,
      body: `${status}${summary}${tallySection}
${cta("Tell your representative where you stand", "Record your position on this bill and compare it with the roll call when the vote happens.", "/vote", "Vote on bills", "/bills", "More bills")}`,
    }),
  };
}

// =============================================================================
// URL inventory shared by the sitemap and the IndexNow submitter
// =============================================================================
const STATIC_URLS = [
  ["/", "daily", "1.0"], ["/congress", "daily", "0.9"], ["/bills", "daily", "0.9"],
  ["/vote", "daily", "0.8"], ["/accountability", "daily", "0.8"], ["/roll-calls", "daily", "0.8"],
  ["/follow-the-money", "weekly", "0.8"], ["/constituents", "weekly", "0.5"],
  ["/about", "monthly", "0.6"], ["/how-it-works", "monthly", "0.6"], ["/benefits", "monthly", "0.5"],
  ["/tutorial", "monthly", "0.5"], ["/welcome", "monthly", "0.5"],
  ["/privacy", "yearly", "0.2"],
];

export async function urlInventory() {
  const [members, bills] = await Promise.all([
    sql`SELECT m.bioguide_id, m.full_name, m.state, m.synced_at, s.updated_at AS stats_at
        FROM rs_members m LEFT JOIN rs_stats s ON s.bioguide_id = m.bioguide_id
        WHERE m.active ORDER BY m.state, m.last_name`,
    summarizedBills().catch(() => []),
  ]);
  const today = isoDate(new Date());
  const urls = STATIC_URLS.map(([p, freq, pri]) => ({
    loc: ORIGIN + p, changefreq: freq, priority: pri,
    lastmod: (p === "/congress" || p === "/bills") ? today : null,
  }));
  const states = [...new Set(members.map((m) => m.state))].filter((c) => STATES[c])
    .sort((a, b) => stateSlug(a).localeCompare(stateSlug(b)));
  for (const c of states) urls.push({ loc: ORIGIN + statePath(c), changefreq: "weekly", priority: "0.7", lastmod: today });
  for (const m of members) {
    urls.push({
      loc: ORIGIN + `/rep/${memberSlug(m)}`, changefreq: "daily", priority: "0.8",
      lastmod: isoDate(m.stats_at) || isoDate(m.synced_at) || today,
    });
  }
  for (const b of bills) {
    urls.push({
      loc: ORIGIN + billPath(b.id), changefreq: "weekly", priority: "0.6",
      // The page changes when Congress acts or when its breakdown is written,
      // whichever came later. Using only the action date hid bills summarized
      // after an IndexNow run from every later run.
      lastmod: [isoDate(b.action_date), isoDate(b.generated_at)].filter(Boolean).sort().pop() || today,
    });
  }
  return urls;
}
