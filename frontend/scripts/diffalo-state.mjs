#!/usr/bin/env node
/**
 * Diffalo state command: `list` prints the state-family catalog, `run <name>`
 * mints one.
 *
 * This app has no accounts — it's a public, no-auth map SPA reading a public
 * fire API + public B2 bucket. There's no "signed-in data" to seed, only a
 * dynamic route to pick: which fire to land the `fire` place on. `directory`
 * and `health` are static and need no state at all, so only `fire` is
 * declared here.
 *
 * Usage:
 *   node diffalo-state.mjs list
 *   node diffalo-state.mjs run <name> --args <json>
 */

const FIRE_API = 'https://fire-api-prod.web.app';

const STATES = [
  {
    name: 'fire',
    description: 'Opens the single-fire map shell on a live, currently active fire (largest by acreage).',
    args: {},
  },
];

// unique_slug "2026-07-23-OR-BIG-GRASS" -> url id "big-grass-or-2026-07-23"
// (mirrors frontend/src/app/fireUrl.ts:slugToUrlId)
function slugToUrlId(uniqueSlug) {
  const m = /^(\d{4}-\d{2}-\d{2})-([A-Za-z]{2})-(.+)$/.exec(uniqueSlug);
  const out = m ? `${m[3]}-${m[2]}-${m[1]}` : uniqueSlug;
  return out.toLowerCase();
}

async function pickFireUrlId() {
  const res = await fetch(`${FIRE_API}/fires`);
  if (!res.ok) throw new Error(`fire API ${res.status}`);
  const { fires } = await res.json();
  if (!fires?.length) throw new Error('fire API returned no fires');
  // Prefer a large, currently-uncontained fire — richest view (perimeters,
  // spread forecast, weather) most reliably populated.
  const sorted = [...fires].sort((a, b) => (b.acres ?? 0) - (a.acres ?? 0));
  const pick = sorted.find((f) => f.unique_slug) ?? sorted[0];
  return slugToUrlId(pick.unique_slug);
}

function parseArgsFlag(argv) {
  const i = argv.indexOf('--args');
  if (i === -1) return {};
  try {
    return JSON.parse(argv[i + 1] ?? '{}');
  } catch {
    return {};
  }
}

async function main() {
  const [cmd, name, ...rest] = process.argv.slice(2);

  if (cmd === 'list') {
    console.log(JSON.stringify({ states: STATES }));
    return;
  }

  if (cmd === 'run') {
    parseArgsFlag(rest); // no args declared; nothing to read yet
    if (name === 'fire') {
      const id = await pickFireUrlId();
      console.log(JSON.stringify({ route: `/fire/${id}`, account: null }));
      return;
    }
    throw new Error(`unknown state: ${name}`);
  }

  throw new Error('usage: diffalo-state.mjs list | run <name> --args <json>');
}

main().catch((err) => {
  console.error(err.stack || String(err));
  process.exit(1);
});
