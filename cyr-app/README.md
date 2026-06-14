# Check Your Representative

A voter-education site: an interactive U.S. map, district lookup, constituent
profiles with plain-language AI bill summaries, and fair bill voting.

This project is ready to run. It ships in **demo mode** so the site looks and
works immediately. You turn on the real data and keys afterward, in stages.

---

## What's in here

```
check-your-representative/
├── index.html                 the page shell
├── src/
│   ├── App.jsx                the homepage (map + onboarding + voting)
│   └── components/            the building blocks
│       ├── ConstituentMap.jsx
│       ├── ConstituentOnboarding.jsx
│       └── ConstituentVoting.jsx
├── public/data/              map + county data the site loads
├── server/                   backend logic (Phase 2 — needs keys + a database)
├── .env.example              template for your secret keys
└── package.json
```

---

## Run it on your own computer (Phase 1)

You need **Node.js** first. Install the "LTS" version from https://nodejs.org
(just click through the installer). Then, in a terminal, inside this folder:

```
npm install      # downloads the building blocks (one time, ~1 minute)
npm run dev      # starts the site
```

It will print a link like `http://localhost:5173` — open that in your browser.
You'll see the live site. The map is clickable; counties and cities appear.
Editing a file and saving updates the page instantly.

Press `Ctrl + C` in the terminal to stop it.

---

## Put it on the internet (Phase 1 — the visual site)

The easiest free host is **Vercel**. Full step-by-step is in the chat, but the
short version:

1. Put this folder on **GitHub** (a free account + the GitHub Desktop app).
2. Go to **vercel.com**, sign in with GitHub, and import the repository.
3. Vercel detects Vite automatically. Click **Deploy**. You get a live URL.
4. In Vercel's **Domains** settings, add `CheckYourRepresentative.com`.

Your site is now live. It still runs in demo mode — see Phase 2 to make the
data real.

---

## Make it real (Phase 2 — keys, live bill data, voting that persists)

The site currently uses built-in sample data so it works with zero setup. Each
component has a `USE_MOCK = true` line at the top. To go real:

1. **Get your keys** (all free): Congress.gov API, Anthropic API, Cloudflare
   Turnstile. Put them in Vercel under **Settings → Environment Variables**
   (use `.env.example` as your checklist). Never paste keys into code.
2. **Add a database.** The files in `server/` hold the vote/profile logic, but
   they use a temporary in-memory store that resets. For data that sticks
   (votes, profiles, the summary cache) connect a real database — Vercel
   Postgres or Vercel KV are the simplest to add.
3. **Cities endpoint.** Build `/api/cities` from a free U.S. places dataset so
   county → city lists are complete (the map ships with a Colorado sample).
4. Flip each `USE_MOCK` to `false` as that piece is wired.

Do these one at a time. The site stays live the whole way.

---

## The one rule that matters

**Never commit your secret keys.** They go in environment variables on your
host, never in the code you push to GitHub. The included `.gitignore` already
blocks the `.env` file for you — leave it in place.
