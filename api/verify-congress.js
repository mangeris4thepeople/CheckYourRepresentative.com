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
// A real data problem (wrong-state member, duplicate district, too many or
// mislabeled members) logs an error and, if email is configured, alerts the
// admin. A genuinely vacant seat is NOT a data problem, it is reported as a
// notice so a normal special-election vacancy does not cry wolf every week.
//
// Runs on a weekly cron (see vercel.json) and can be called by hand anytime.
// =============================================================================
const CONGRESS_API_KEY = process.env.CONGRESS_API_KEY;
const RESEND_API_KEY = process.env.RESEND_API_KEY;
const ADMIN_EMAIL = "mangeris4thepeople2026@gmail.com";
const CONCURRENCY = 8;

// Apportioned U.S. House seats per state from the 2020 Census, fixed by law
// for the 119th Congress and every Congress through the 2032 cycle. These are
// structural seat counts, not member identities. They let the check tell a
// real vacancy (fewer sitting members than apportioned seats) apart from a
// silent data failure (too many members, or members from the wrong state).
// Revisit after the 2030 Census reapportionment.
const HOUSE_SEATS = {
  AL:7, AK:1, AZ:9, AR:4, CA:52, CO:8, CT:5, DE:1, FL:28, GA:14,
  HI:2, ID:2, IL:17, IN:9, IA:4, KS:4, KY:6, LA:6, ME:2, MD:8,
  MA:9, MI:13, MN:8, MS:4, MO:8, MT:2, NE:3, NV:4, NH:2, NJ:12,
  NM:3, NY:26, NC:14, ND:1, OH:15, OK:5, OR:6, PA:17, RI:2, SC:7,
  SD:1, TN:9, TX:38, UT:4, VT:1, VA:11, WA:10, WV:2, WI:8, WY:1,
};
const STATES = Object.keys(HOUSE_SEATS);

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
          : { state: st, ok: false, problems: [`lookup failed: ${String(r.reason && r.reason.message || r.reason)}`], notices: [], senators: [], reps: [], vacancies: 0 };
      });
    }

    // Global totals.
    let totalSenators = 0, totalReps = 0, totalVacancies = 0;
    const problemStates = [];
    const vacancyStates = [];
    for (const st of STATES) {
      const s = byState[st];
      totalSenators += s.senators.length;
      totalReps += s.reps.length;
      totalVacancies += s.vacancies || 0;
      if (s.problems.length) problemStates.push(st);
      if ((s.vacancies || 0) > 0 || s.senators.length < 2) vacancyStates.push(st);
    }

    // Only too-many senators is a hard problem. A shortfall is a notice, since
    // Senate seats can be legitimately vacant between a resignation and an
    // appointment or special election.
    const globalProblems = [];
    if (totalSenators > 100) globalProblems.push(`found ${totalSenators} senators, more than the 100 seats`);

    const ok = problemStates.length === 0 && globalProblems.length === 0;

    if (!ok) {
      console.error("[verify-congress] MISMATCH", { problemStates, globalProblems });
      await alertAdmin({ problemStates, globalProblems, byState }).catch(e =>
        console.error("[verify-congress] alert failed:", e.message));
    } else {
      console.log(`[verify-congress] clean. senators=${totalSenators}/100 sitting reps=${totalReps} vacancies=${totalVacancies}`);
    }

    return res.status(200).json({
      ok,
      checkedAt: new Date().toISOString(),
      totals: { senators: totalSenators, sittingReps: totalReps, apportionedSeats: 435, vacancies: totalVacancies },
      globalProblems,
      problemStates,
      vacancyStates,
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
  const problems = [];   // hard data errors: these alert
  const notices = [];    // expected real-world conditions like vacancies

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

  // Two senators is the norm. More than two is impossible and a real error.
  // Fewer is a vacancy, reported but not treated as data corruption.
  if (senators.length > 2) {
    problems.push(`found ${senators.length} senators, only 2 seats exist: ${senators.map(s => s.name).join(", ")}`);
  } else if (senators.length < 2) {
    notices.push(`senate vacancy: only ${senators.length} of 2 senators currently seated`);
  }

  // No district represented by more than one member.
  const seen = new Map();
  for (const r of reps) {
    const key = String(r.district);
    if (seen.has(key)) problems.push(`district ${key} has more than one representative: ${seen.get(key)} and ${r.name}`);
    else seen.set(key, r.name);
  }

  // Sitting House members should never exceed the state's apportioned seats.
  // Fewer means one or more vacant seats, which is normal between elections.
  const expectedReps = HOUSE_SEATS[state];
  if (reps.length > expectedReps) {
    problems.push(`found ${reps.length} House members, more than the ${expectedReps} apportioned seats`);
  }
  const vacancies = Math.max(0, expectedReps - reps.length);
  if (vacancies > 0) notices.push(`${vacancies} vacant House seat(s) of ${expectedReps} apportioned`);

  return { state, ok: problems.length === 0, expectedReps, vacancies, senators, reps, problems, notices };
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
