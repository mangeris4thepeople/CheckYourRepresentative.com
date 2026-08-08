// Shared helpers for the NGO Money Loop ETLs: database pool, name
// normalization, and polite fetching with retries.
import pg from 'pg';

export function makePool() {
  if (!process.env.DATABASE_URL) {
    console.error('DATABASE_URL is not set. Aborting.');
    process.exit(1);
  }
  return new pg.Pool({ connectionString: process.env.DATABASE_URL, max: 4 });
}

// Collapse an organization name to a comparable key: lowercase, strip
// punctuation, drop corporate suffixes and stopwords that vary between the
// TRACER filing and the IRS record ("Inc", "The", trailing "Incorporated").
// This is deliberately conservative: it exists to line up spellings of the
// same name, not to guess that two different names are the same org. The
// human review queue owns that judgment.
const DROP_WORDS = new Set([
  'inc', 'incorporated', 'llc', 'llp', 'ltd', 'co', 'corp', 'corporation',
  'company', 'the', 'of', 'a', 'an', 'and',
]);

export function normalizeName(raw) {
  if (!raw) return '';
  return String(raw)
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, ' ')
    .split(/\s+/)
    .filter((w) => w && !DROP_WORDS.has(w))
    .join(' ')
    .trim();
}

export function cleanEin(raw) {
  const d = String(raw || '').replace(/\D/g, '');
  return d.length === 9 ? d : null;
}

// fetch with retry and a real User-Agent; some government hosts reject the
// default undici agent string.
export async function politeFetch(url, opts = {}, tries = 4) {
  let lastErr;
  for (let attempt = 1; attempt <= tries; attempt++) {
    try {
      const res = await fetch(url, {
        ...opts,
        headers: {
          'User-Agent': 'CheckYourRepresentative.com data pipeline (contact: Info@checkyourrepresentative.com)',
          ...(opts.headers || {}),
        },
      });
      if (res.status === 429 || res.status >= 500) {
        throw new Error(`HTTP ${res.status}`);
      }
      return res;
    } catch (err) {
      lastErr = err;
      if (attempt < tries) {
        const waitMs = 2000 * 2 ** (attempt - 1);
        console.warn(`fetch ${url} failed (${err.message}), retry in ${waitMs}ms`);
        await sleep(waitMs);
      }
    }
  }
  throw lastErr;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
