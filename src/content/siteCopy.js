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

// The short commitment page linked as "Privacy" in the footer. This is not a
// formal legal privacy policy, it is the plain-English promise from the About
// section. A full policy is still to be written and reviewed separately.
export const PRIVACY_COMMITMENT = {
  heading: "Our Privacy Commitment",
  paragraphs: [
    "Your profile can be public or private. That is your choice, and you can change it " +
      "anytime in your account settings. Public means your display name, city, bio, and " +
      "votes appear on your shareable card. Private means only you can see them.",
    "Your information and your votes will never be sold to anyone. Not a campaign, not a " +
      "PAC, not a data broker, not any institution, period. This site exists to give " +
      "power back to people, not to become another place your data gets monetized.",
    "Your full street address is only ever used privately, to match you to your " +
      "congressional district. It is not shown on your public card and it is not shared.",
  ],
  footnote:
    "This is a plain-English summary of how we treat your data. A full formal privacy " +
    "policy is being prepared and will be published here once it is reviewed.",
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
      title: "Enter your address on Find District.",
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
  district: {
    title: "Find District",
    intro: "Enter your address once to personalize the whole site around your district.",
    items: [
      { label: "Enter your address", desc: "This is how the site matches you to your congressional district and representative." },
      { label: "Why it matters", desc: "Your district is what personalizes Accountability, Roll Calls, and your own profile. Your full address is only used for this match, never shown or shared." },
      { label: "Or explore the map", desc: "Browse districts on the map to look around, without changing the district your account is registered to." },
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
