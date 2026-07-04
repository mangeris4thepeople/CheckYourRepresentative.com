// =============================================================================
// GET /api/verify-congress - authoritative roster check for all 50 states.
//
// This is the safeguard. It exists so a wrong member never reaches a
// constituent unnoticed again. It pulls the current roster from Congress.gov,
// state by state, and confirms:
//   - every state has exactly two senators,
//   - no district has more than one representative (no duplicates),
//   - every member the API returns for a state is actually FROM that state
//     (this is the exact failure that showed non-Colorado "senators" for CO),
//   - Congress-wide totals line up: 100 senators, 435 voting House seats.
//
// On any mismatch it logs an error (visible in Vercel logs) and, if email is
// configured, sends the admin a summary. A clean run returns ok:true with the
// full state-by-state breakdown so the result can be read directly.
//
// Runs on a weekly cron (see vercel.json) and can be called by hand anytime.
// =============================================================================
const CONGRESS = 119;
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = "mangeris4thepeople2026@gmail.com";
const CONCURRENCY = 8;

const STATES = [
  "AL","AK","AZ","AR","CA","CO","CT","DE","FL","GA",
  "HI","ID","IL","IN","IA","KS","KY","LA","ME","MD",
  "MA","MI","MN","MS","MO","MT","NE","NV","NH","NJ",
  "NM","NY","NC","ND","OH","OK","OR","PA","RI","SC",
  "SD","TN","TX","UT","VT","VA","WA","WV","WI","WY",
];

export default async function handler(req, res) {
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Cache-Control", "no-store");
  if (!CONGRESS_API_KEY) return res.status(500).json({ error: "CONGRESS_API_KEY not set" });

  try {
    const byState = {};
    for (let i = 0; i < STATES.length; i += CONCURRENCY) {
      const batch = STATES.slice(i, i + CONCURRENCY);
      const results = await Promise.allSettled(batch.map(st => checkState(st)));
      results.forEach((r, idx) => {
        const st = batch[idx];
        byState[st] = r.status === "fulfilled"
          ? r.value
          : { state: st, ok: false, problems: [`lookup failed: ${String(r.reason && r.reason.message || r.reason)}`], senators: [], reps: [] };
      });
    }

    // Global totals.
    let totalSenators = 0, totalReps = 0;
    const problemStates = [];
    for (const st of STATES) {
      const s = byState[st];
      totalSenators += s.senators.length;
      totalReps += s.reps.length;
      if (!s.ok) problemStates.push(st);
    }

    const globalProblems = [];
    if (totalSenators !== 100) globalProblems.push(`expected 100 senators, found ${totalSenators}`);
    if (totalReps !== 435) globalProblems.push(`expected 435 voting House seats, found ${totalReps}`);

    const ok = problemStates.length === 0 && globalProblems.length === 0;

    if (!ok) {
      console.error("[verify-congress] MISMATCH", { problemStates, globalProblems });
      await alertAdmin({ problemStates, globalProblems, byState }).catch(e =>
        console.error("[verify-congress] alert failed:", e.message));
    }

    return res.status(200).json({
      ok,
      checkedAt: new Date().toISOString(),
      totals: { senators: totalSenators, reps: totalReps },
      globalProblems,
      problemStates,
      states: byState,
    });
  } catch (err) {
    console.error("[verify-congress] fatal:", err);
    return res.status(500).json({ error: "verify_failed", detail: String(err.message || err) });
  }
}

async function checkState(state) {
  const data = await cg(`/member/${state}`, { currentMember: "true", limit: 60 });
  const members = data.members || [];

  const senators = [];
  const reps = [];
  const problems = [];

  for (const m of members) {
    // Guard against the mislabel bug directly: the API stamps each member with
    // its real state, so anything not matching the requested state is wrong.
    const memberState = normalizeState(m.state);
    if (memberState && memberState !== state) {
      problems.push(`member ${m.name} is from ${memberState}, not ${state}`);
      continue;
    }
    if (isSenator(m)) {
      senators.push({ name: m.name, party: m.partyName || m.party || "", bioguideId: m.bioguideId });
    } else if (latestChamber(m) === "House of Representatives") {
      reps.push({ name: m.name, party: m.partyName || m.party || "", district: m.district ?? "At Large", bioguideId: m.bioguideId });
    }
  }

  if (senators.length !== 2) {
    problems.push(`expected 2 senators, found ${senators.length}: ${senators.map(s => s.name).join(", ") || "(none)"}`);
  }

  // No district represented by more than one member.
  const seen = new Map();
  for (const r of reps) {
    const key = String(r.district);
    if (seen.has(key)) problems.push(`district ${key} has more than one representative: ${seen.get(key)} and ${r.name}`);
    else seen.set(key, r.name);
  }

  return { state, ok: problems.length === 0, senators, reps, problems };
}

// Congress.gov returns full state names ("Colorado"); map back to the code.
const STATE_NAME_TO_CODE = {
  Alabama:"AL",Alaska:"AK",Arizona:"AZ",Arkansas:"AR",California:"CA",Colorado:"CO",Connecticut:"CT",
  Delaware:"DE",Florida:"FL",Georgia:"GA",Hawaii:"HI",Idaho:"ID",Illinois:"IL",Indiana:"IN",Iowa:"IA",
  Kansas:"KS",Kentucky:"KY",Louisiana:"LA",Maine:"ME",Maryland:"MD",Massachusetts:"MA",Michigan:"MI",
  Minnesota:"MN",Mississippi:"MS",Missouri:"MO",Montana:"MT",Nebraska:"NE",Nevada:"NV","New Hampshire":"NH",
  "New Jersey":"NJ","New Mexico":"NM","New York":"NY","North Carolina":"NC","North Dakota":"ND",Ohio:"OH",
  Oklahoma:"OK",Oregon:"OR",Pennsylvania:"PA","Rhode Island":"RI","South Carolina":"SC","South Dakota":"SD",
  Tennessee:"TN",Texas:"TX",Utah:"UT",Vermont:"VT",Virginia:"VA",Washington:"WA","West Virginia":"WV",
  Wisconsin:"WI",Wyoming:"WY",
};
function normalizeState(s) {
  if (!s) return null;
  if (s.length === 2) return s.toUpperCase();
  return STATE_NAME_TO_CODE[s] || null;
}

function latestChamber(m) {
  const items = (m && m.terms && m.terms.item) || [];
  if (!items.length) return null;
  return items[items.length - 1].chamber || null;
}
function isSenator(m) {
  const chamber = latestChamber(m);
  if (chamber) return chamber === "Senate";
  return m.district === null || m.district === undefined;
}

async function alertAdmin({ problemStates, globalProblems, byState }) {
  if (!RESEND_API_KEY) return;
  const lines = [];
  if (globalProblems.length) lines.push("Congress-wide:", ...globalProblems.map(p => "  - " + p), "");
  for (const st of problemStates) {
    lines.push(`${st}:`);
    for (const p of byState[st].problems) lines.push("  - " + p);
  }
  const body = `Roster verification found problems on ${new Date().toISOString()}.\n\n${lines.join("\n")}\n\nCheck /api/verify-congress for the full report.`;
  await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { "Authorization": `Bearer ${RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: "Check Your Representative <onboarding@resend.dev>",
      to: [ADMIN_EMAIL],
      subject: `ROSTER MISMATCH: ${problemStates.length} state(s) need attention`,
      text: body,
    }),
  });
}

async function cg(path, params = {}) {
  const qs = new URLSearchParams({ format: "json", api_key: CONGRESS_API_KEY, ...params });
  const r = await fetch(`https://api.congress.gov/v3${path}?${qs}`);
  if (!r.ok) throw new Error(`congress ${r.status} on ${path}`);
  return r.json();
}
