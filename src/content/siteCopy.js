// =============================================================================
// siteCopy.js - single source of truth for the site's explanatory copy.
//
// The marketing pages (About, How It Works, How This Benefits, Site Tutorial,
// Privacy Commitment), the dismissible homepage banner, the first run
// walkthrough, and the in-app contextual help sidebars all read from here, so
// wording never drifts between the tutorial page and the sidebar that
// summarizes it.
//
// Accuracy note: the "Verified" counter on My Profile is NOT identity
// verification. It counts how many of your positions were cast from a network
// location that matched your district's state (see api/vote.js geoTier). The
// copy below reflects that. There is no voter record check anywhere in the
// product, so nothing here should imply one.
//
// House style: no em dashes or en dashes anywhere. Commas, periods, colons.
// =============================================================================

export const BANNER = {
  headline: "What is this?",
  body:
    "CheckYourRepresentative.com shows you exactly how your member of Congress voted, " +
    "who funded them, and who actually benefits, before you decide what you think. " +
    "Enter your address, find your district, and cast your own position on the bills " +
    "sitting in front of Congress right now. No spin. No talking points. Just the record.",
  learnMore: "Learn how this works",
};

export const ABOUT = {
  heading: "What We Stand For",
  missionLine:
    "This site exists to capture what We the People actually think, before our " +
    "representatives ever cast a vote.",
  paragraphs: [
    "Every member of Congress works for you. Not their party, not the donors funding " +
      "their campaign, not the industries lobbying their office, you. The moment they " +
      "forget that, the Constitution already gives you the tool to fix it, the vote. Not " +
      "someday, not at a town hall they might not hold, at the next election, with the " +
      "full record in hand.",
    "The men who wrote the Constitution built a system for a country of a few million " +
      "people, spread out, slow to communicate, impossible to poll in real time. They " +
      "could not have imagined a country of over 250 million adults who can read a bill, " +
      "see who funded it, and register a position on it the same day it hits the floor. " +
      "We can. That capability did not exist for most of this country's history. It " +
      "exists now, and it has been sitting unused.",
    "We do not have to pretend this is a direct democracy to use that capability. We " +
      "live in a constitutional republic, you do not vote directly on every bill, you " +
      "send someone to Washington to vote on your behalf. That representative works for " +
      "you by design, not by favor. This site does not change that structure, it makes " +
      "it visible. When someone has held a seat for twenty, thirty, fifty years, you can " +
      "finally see, bill by bill, whether their voting record still matches the people " +
      "who kept sending them back, or whether it quietly stopped a long time ago.",
    "Your profile can be public or private, your choice, changeable anytime in your " +
      "account settings. Your information and your votes will never be sold to anyone, " +
      "not a campaign, not a PAC, not a data broker, not any institution, period. This " +
      "exists to give power back to people, not to become another place your data gets " +
      "monetized.",
    "Accountability does not stop at Congress. Judges shape daily life as much as any " +
      "legislator, so Know Your Judge covers the whole country: a heat map of every state's " +
      "sitting judges that drills from state to county to courthouse and city, with each " +
      "judge's Ruling Record built from public court data, raw counts of the opinions they " +
      "authored, never a score or a grade. Colorado gets the deepest treatment, with the " +
      "state's own performance evaluations and every past retention election result, so a " +
      "retention ballot line gets the same scrutiny as every vote in Washington.",
    "This is not a partisan project. Progressive, Conservative, Independent, Libertarian, " +
      "Green, Socialist, it does not matter where you start. The bills are the same for " +
      "everyone, and so is the record. Freedom does not erode all at once, it erodes one " +
      "unwatched vote at a time. This site exists so nobody has to watch alone.",
  ],
};

export const HOW_IT_WORKS = {
  heading: "How to Use This Site",
  steps: [
    {
      n: "1",
      title: "Find your representative.",
      body:
        "Enter your address. We match you to your district and show you who represents " +
        "you and their party.",
    },
    {
      n: "2",
      title: "Read the bill, not the headline.",
      body:
        "For every active bill, we break down who benefits, who is worse off, the PAC and " +
        "donor money behind it, and which industries have a financial stake. Read that " +
        "before you decide.",
    },
    {
      n: "3",
      title: "Cast your position.",
      body:
        "Support, oppose, or undecided. One position per bill, per account. This builds a " +
        "real record of what your district actually thinks, before the vote happens.",
    },
    {
      n: "4",
      title: "Check the record.",
      body:
        "Once your representative actually votes, Roll Calls shows you exactly how, next " +
        "to how your district voted. No more waiting on a press release to find out.",
    },
    {
      n: "5",
      title: "Hold the line.",
      body:
        "Accountability shows the pattern over time, does your representative's voting " +
        "record match what their district actually wanted. Contact Your Representative " +
        "lets you tell them directly when it does not.",
    },
    {
      n: "6",
      title: "Follow the money.",
      body:
        "The Follow the Money tab covers who funds power and who receives public spending, " +
        "in four sub-sections. Know Your Rep gives you a full profile on every member of " +
        "the House: their bio, every dollar their campaign has ever reported raising by " +
        "cycle, every quarterly filing they have submitted to the FEC with a direct link " +
        "to the actual filing, and their top donors ranked by dollar amount, searchable by " +
        "name or district. NGO Funding shows how much of an advocacy organization's " +
        "reported revenue can be traced to a public, dollar-level disclosure, and how much " +
        "the law leaves as an aggregate lump, using only what is already public. Social " +
        "Security shows retirement, survivors, and disability beneficiary counts and total " +
        "monthly benefits by state, sourced from the Social Security Administration, " +
        "currently 2015 data, the most recent state-level breakdown published in this form. " +
        "Medicare and Medicaid spending by state is coming soon to the same tab.",
    },
  ],
};

export const BENEFITS = {
  heading: "How This Benefits You And The Country",
  paragraphs: [
    "For you personally, this closes the gap between casting a vote once every two years " +
      "and actually knowing what your representative does with the other seven hundred and " +
      "twenty-nine days in between. You see the bill, the money behind it, and who it " +
      "actually helps or hurts, before your representative votes, not after. You build a " +
      "record of your own position, and you can measure your representative against that " +
      "record instead of against their own talking points.",
    "For the country, this works because it works at scale. One constituent writing a " +
      "letter gets a form response. Thousands of constituents in the same district " +
      "registering a position on the same bill, publicly, before the vote, is something " +
      "no representative's office can quietly ignore or spin after the fact. This site " +
      "does not lobby for you. It gives you the same information the lobbyists already " +
      "have, at the same time they have it, so the record reflects what districts " +
      "actually wanted, not just what got funded the loudest.",
  ],
};

// Short line reused on the signup screen and next to the profile privacy toggle.
export const PRIVACY_SHORT =
  "Your profile can be public or private, your choice. Your information and votes are " +
  "never sold to anyone.";

// The Privacy Policy shown on the footer "Privacy" page. The data storage,
// analytics, and contact sections are filled from the real infrastructure
// (Neon PostgreSQL, Resend, Vercel, no analytics tooling). This draft still
// needs legal review before it is treated as final.
export const PRIVACY_POLICY = {
  title: "Privacy Policy",
  // Set to the publish date. Update if the policy is approved on a later date.
  effectiveDate: "July 4, 2026",
  sections: [
    {
      heading: "What we collect",
      body: [
        "When you create an account, we collect your email address. There is no password, " +
          "we use a one-time sign in link sent to your email instead.",
        "When you use the district lookup on My Profile, the address you enter is used only " +
          "to match you to your congressional district and representative. The address itself " +
          "is never stored.",
        "If you fill in optional profile fields, we collect your display name, city or town, " +
          "and bio, only if you choose to provide them.",
        "We collect the positions you cast on bills, support, oppose, or undecided, and the " +
          "time you cast them.",
      ],
    },
    {
      heading: "What we never collect",
      body: [
        "We do not collect your Social Security number, financial information, or any " +
          "government identification. We do not track you across other websites.",
      ],
    },
    {
      heading: "How we use what we collect",
      body: [
        "Your email is used to sign you in and, if you opt in, to send you digest emails " +
          "about new bills.",
        "Your address is used only to match you to your congressional district. It is not " +
          "shown publicly, not to other users, not on your shareable profile card, not " +
          "anywhere on the site.",
        "Your display name, city or town, bio, and votes are shown to others only if you set " +
          "your profile to public. If your profile is private, none of this is visible to " +
          "anyone but you. You can switch between public and private anytime in your account " +
          "settings, and it takes effect immediately.",
        "Aggregated, anonymized vote totals (for example, how a district voted overall on a " +
          "bill) are shown publicly regardless of your individual profile setting, but these " +
          "totals do not identify you individually unless you have chosen to make your own " +
          "profile public.",
      ],
    },
    {
      heading: "What we never do",
      body: [
        "We never sell your information or your votes to anyone. Not a political campaign, " +
          "not a PAC, not a data broker, not any institution, for any price, period.",
        "We never share your full address with anyone outside the systems needed to match " +
          "you to a district.",
      ],
    },
    {
      heading: "Data storage and security",
      body: [
        "Your account information, profile fields, and votes are stored in a PostgreSQL " +
          "database hosted by Neon. Sign in links and digest emails are sent through Resend. " +
          "The site is hosted on Vercel. Connections to the site are served over HTTPS, and " +
          "our database and email providers encrypt data in transit and at rest.",
        "We do not store passwords. Sign in uses a one-time link sent to your email, and " +
          "each signed in session uses a token that expires. To keep you signed in, that " +
          "session token is kept in your browser's local storage, not in tracking cookies.",
        "To limit spam and automated abuse, we log the IP address and network subnet " +
          "associated with sign in requests and vote submissions, and we apply rate limits " +
          "based on them. When you cast a vote, your IP address is also sent to a third-party " +
          "geolocation service to record whether the vote came from within your district's " +
          "state. This is used only as a quality signal on the vote and is not used to " +
          "identify you personally.",
      ],
    },
    {
      heading: "Analytics",
      body: [
        "We do not use Google Analytics, Vercel Web Analytics, or any other product " +
          "analytics or user-tracking tool. We do not track your page views or tie any " +
          "browsing activity to your account.",
        "The only third-party resource loaded in your browser is Google Fonts, used for the " +
          "site's typography, which is not analytics. Our hosting and database providers keep " +
          "standard operational server logs, which can include IP addresses, for security and " +
          "reliability.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        "You can make your profile private or public at any time. You can request that we " +
          "delete your account and associated data by contacting us at " +
          "Info@checkyourrepresentative.com",
      ],
    },
    {
      heading: "Children's privacy",
      body: [
        "This site is not directed at children and is not intended for use by anyone under " +
          "the legal voting age.",
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If this policy changes in a way that affects how your data is used, we will update " +
          "this page and change the effective date above. If you have opted in to email, we " +
          "will also send you a notice. If you have opted out of email, we will respect that " +
          "choice and will not email you, so please check this page for the current version.",
      ],
    },
    {
      heading: "Contact",
      body: [
        "Questions about this policy can be sent to Info@checkyourrepresentative.com",
      ],
    },
  ],
};

// Getting-started steps for the Site Tutorial walkthrough. District matching is
// the end of setup: there is no separate identity verification step.
export const TUTORIAL_GETTING_STARTED = {
  heading: "Getting started",
  steps: [
    {
      n: "1",
      title: "Enter your email.",
      body: "There is no password to create or remember, we use a magic link.",
    },
    {
      n: "2",
      title: "Check your email and click the sign in link we send you.",
      body: "That link signs you in.",
    },
    {
      n: "3",
      title: "Enter your address on My Profile.",
      body:
        "This matches you to your congressional district and your representative, and " +
        "personalizes everything else on the site around that district. That is all the " +
        "setup there is.",
    },
  ],
};

// Per-page control explanations. Each item is one control and a short
// description. The Site Tutorial page shows these with a section intro, and the
// in-app contextual sidebars reuse the same items trimmed to their short form,
// so the two never disagree.
export const TUTORIAL_PAGES = {
  profile: {
    title: "My Profile",
    intro: "Your account, your record, and your privacy controls all live here.",
    items: [
      { label: "Signed in as / District", desc: "Confirms who you are signed in as and which district you were matched to." },
      { label: "Sign Out", desc: "Ends your session." },
      { label: "Profile / My Votes / Share tabs", desc: "Profile is your account details. My Votes is your own history of every position you have cast. Share generates a public link or card of your voting record, only if your profile is public." },
      { label: "Votes Cast", desc: "The total number of bills you have cast a position on." },
      { label: "Verified", desc: "How many of your positions were cast from a network location that matched your district's state. It is a location signal on each vote, not an identity check." },
      { label: "District", desc: "The congressional district you were matched to." },
      { label: "Find Your District", desc: "Enter your address to match yourself to your congressional district and representative. Your address is only ever used for this match, never stored, never shown or shared." },
      { label: "Or explore the map", desc: "Browse districts on the map to look around, without changing the district your account is registered to." },
      { label: "Display Name (optional)", desc: "What shows instead of your email if your profile is public. Leave blank to stay anonymous even when public." },
      { label: "City / Town", desc: "A general location shown on your public profile. This is not your full address, which is only ever used privately to match your district." },
      { label: "Bio (optional)", desc: "A short personal statement shown on your public card if your profile is public." },
      { label: "Email Digest", desc: "Choose what triggers an email from us, for example an alert when new bills hit the floor. Change or turn it off anytime." },
      { label: "Public Profile / Make Private", desc: "Public means your display name, city, bio, and votes are visible on your shareable card. Private means none of that is visible to anyone but you. Takes effect immediately." },
      { label: "Save Profile", desc: "Commits any changes you made above." },
    ],
  },
  vote: {
    title: "Vote on Bills",
    intro: "Work through the bills in front of Congress and cast your position on each.",
    items: [
      { label: "Counter at the top", desc: "How many active bills on the floor you still have not voted on, out of the total active right now." },
      { label: "All bills", desc: "Browse every active bill from the start." },
      { label: "Next bill", desc: "Jumps to the next active bill you have not voted on yet. Use it to work through your queue one at a time." },
      { label: "Previous bills", desc: "Steps backward through bills you have already voted on, so you can review your record." },
      { label: "Voted on / Not voted on", desc: "Switch between only the bills you have already positioned on, or only the ones still waiting on you." },
      { label: "The four expandable sections", desc: "Who benefits, who is worse off, PAC and donor money behind it, and industries with a financial stake. Open them to read the plain-English breakdown before you vote." },
      { label: "Vote tally bar", desc: "Shows how the country has voted on this bill so far." },
      { label: "Support / Oppose / Undecided", desc: "Your position. One per bill, per account, permanent once cast. It cannot be changed or resubmitted, so read first." },
    ],
  },
  followthemoney: {
    title: "Follow the Money",
    intro: "Everything about who funds power and who receives public spending, in one tab: Know Your Rep, NGO Funding, Medicare and Medicaid, and Social Security. Switch between the four with the sub-tabs at the top, using only public disclosures.",
    items: [
      { label: "Sub-tabs", desc: "Know Your Rep, NGO Funding, Medicare and Medicaid, and Social Security. Your choice is saved in the page's link, so you can share a link straight to one of them." },
      { label: "Know Your Rep, search bar", desc: "Search by representative name, state, or district." },
      { label: "Know Your Rep, the list", desc: "Twenty representatives at a time. Use Load More to keep browsing rather than loading all 435 at once." },
      { label: "Know Your Rep, per-cycle financial totals", desc: "How much each representative's campaign has raised and spent, and how much came from individuals versus PACs versus the party, by two-year election cycle." },
      { label: "Know Your Rep, FEC filings", desc: "Every quarterly and periodic report a representative's campaign has filed with the FEC, each with a direct link to the original filing on FEC.gov." },
      { label: "Know Your Rep, top donors", desc: "The largest disclosed contributors to a representative's campaign, ranked by dollar amount. This is a bounded list of the biggest sources, not every single contribution ever filed." },
      { label: "NGO Funding, what this section is", desc: "For each organization, it shows how much of its reported revenue can be traced to a public, dollar-level disclosure, and how much the law only requires as an aggregate lump." },
      { label: "NGO Funding, state / source type / fiscal year filters", desc: "Narrow the list by state, by the kind of funding (federal award, foreign principal, PAC, and so on), or by year." },
      { label: "NGO Funding, the traceability bar", desc: "Each row shows what percent of that org's revenue is traceable to a named public source. Click a row to open the organization." },
      { label: "NGO Funding, funding transparency score", desc: "The percent of reported revenue traced to a dollar-level disclosure. A low score usually means the org relies on donors the law does not require to be itemized, not that anything is being hidden improperly." },
      { label: "NGO Funding, traceable funding events", desc: "The individual disclosed dollars behind the score: federal awards, foreign principal payments (FARA), PAC contributions (FEC), and grants from other nonprofits." },
      { label: "NGO Funding, reported revenue and grants made", desc: "The organization's total revenue by year from its tax filing, and the grants it passed on to other organizations." },
      { label: "Medicaid, the national map", desc: "A heat map of all 50 states colored by the share of people covered by Medicaid or other means-tested public health coverage, darkest red where coverage is highest. Hover any state for its numbers." },
      { label: "Medicaid, state breakdowns", desc: "Click any state on the map or in the ranked list for its full breakdown by county and by city or town, with a search across every place the Census publishes." },
      { label: "Medicaid, where the data comes from", desc: "US Census Bureau American Community Survey 5-year estimates, table S2704. Counts people with Medicaid or means-tested public coverage, alone or in combination with other insurance. CMS publishes dollar spending at the state level only." },
      { label: "SNAP / Food Stamps, the national map", desc: "A heat map of all 50 states colored by the share of households receiving SNAP benefits, darkest red where participation is highest. Hover any state for its numbers." },
      { label: "SNAP / Food Stamps, state breakdowns", desc: "Click any state on the map or in the ranked list to see its full breakdown by county and by city or town, with a search across every place the Census publishes." },
      { label: "SNAP / Food Stamps, where the data comes from", desc: "US Census Bureau American Community Survey 5-year estimates, table S2201, the only public dataset covering every city and county. It reports households receiving benefits; USDA publishes dollar payouts at the state level only." },
    ],
  },
  judges: {
    title: "Know Your Judge",
    intro: "Colorado judges do not run in contested elections, you vote to retain or remove them. This section exists so that ballot line is never a blind guess.",
    items: [
      { label: "What this section is", desc: "One national directory of sitting state court judges, built on the Free Law Project's CourtListener database. It opens on a heat map of the whole country and drills all the way down to a single judge's public ruling record." },
      { label: "The national heat map", desc: "Every state colored by its sitting judges on file, with a toggle between total judges and judges per 100,000 residents. Click any state to drill in." },
      { label: "State and county drill down", desc: "A state's page shows its statewide courts first (supreme and appellate), then a county heat map. Click a county for its courts grouped by city, each with a plain language explanation of what that court handles and its sitting judges." },
      { label: "Ruling Record", desc: "Each judge's profile shows raw public record counts from opinions they authored: totals, the majority, concurrence, and dissent split, and outcomes where the public feed carries them. Counts only, never a score, grade, or ranking, with a link to every opinion on CourtListener." },
      { label: "Search", desc: "Below the national map, search every judge by name or court and filter by state." },
      { label: "Colorado retention data", desc: "Colorado's state page keeps the full retention section: every judge's official OJPE performance evaluation and the actual yes and no vote counts from past retention elections." },
      { label: "Performance evaluations (OJPE)", desc: "The Colorado Office of Judicial Performance Evaluation formally evaluates every judge before their retention election and publishes a recommendation. We show that recommendation and link the full published narrative." },
      { label: "Retention election results", desc: "The actual yes and no vote counts from each retention election a judge has faced, from official Secretary of State records." },
      { label: "Where the data comes from", desc: "Appellate judges from the Free Law Project's CourtListener. Evaluations and retention results transcribed from official state publications." },
      { label: "Social Security, what this section shows", desc: "Retirement, survivors, and disability insurance (OASDI) beneficiary counts and total monthly benefits, by state, sourced from the Social Security Administration. The current data is from 2015, the most recent state-level breakdown SSA has published in this form." },
      { label: "Social Security, your state", desc: "Pinned to the top once your district is matched, so you see your own state's figures first." },
      { label: "Social Security, search", desc: "Search the full list of states and territories by name or abbreviation." },
    ],
  },
};

// Remaining in-app areas, for the full Site Tutorial page. These pages do not
// get a contextual sidebar, so they only appear on the tutorial page.
export const TUTORIAL_OTHER = [
  {
    title: "All Active Bills",
    body:
      "Every bill currently active in Congress, not a curated subset. Use this to browse " +
      "broadly rather than working through the Vote on Bills queue one at a time.",
  },
  {
    title: "Accountability",
    body:
      "Shows how your district has voted, position by position, and once your " +
      "representative casts their actual recorded vote, whether it matched. This is where " +
      "the long-term pattern becomes visible, one vote does not tell you much, dozens over " +
      "years tell you a lot.",
  },
  {
    title: "Roll Calls",
    body:
      "Every recorded vote in Congress, with every representative's name attached to how " +
      "they actually voted. No summaries, the primary record.",
  },
  {
    title: "Constituents",
    body:
      "A public directory of positions by district, so you can see whether your view is " +
      "shared by others near you, and so does everyone else.",
  },
  {
    title: "Merch",
    body: "Supports keeping the tool running and free for everyone to use.",
  },
];

// Plain-English glossary of Congress.gov's bill-type prefixes, shown as a
// collapsible legend above the Accountability page's bill-type tabs.
export const BILL_TYPE_LEGEND = [
  { code: "HR", name: "House Bill", desc: "Introduced in the House. If passed by both chambers and signed, it can become law." },
  { code: "S", name: "Senate Bill", desc: "Introduced in the Senate. Same path to becoming law as an HR bill." },
  { code: "HRES", name: "House Resolution", desc: "Addresses House-only matters, like internal rules. Cannot become law." },
  { code: "SRES", name: "Senate Resolution", desc: "Addresses Senate-only matters. Cannot become law." },
  { code: "HJRES", name: "House Joint Resolution", desc: "Carries the same legal force as a bill, often used for things like constitutional amendments or continuing resolutions." },
  { code: "SJRES", name: "Senate Joint Resolution", desc: "Same as HJRES, originating in the Senate." },
  { code: "HCONRES", name: "House Concurrent Resolution", desc: "Expresses the shared position of both chambers, but does not have the force of law." },
  { code: "SCONRES", name: "Senate Concurrent Resolution", desc: "Same as HCONRES, originating in the Senate." },
];
