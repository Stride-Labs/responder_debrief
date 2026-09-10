#!/usr/bin/env node
/**
 * Diffalo review state families for Responder Debrief.
 *
 * This app has no accounts or sign-in. Never emit `account` — the generic
 * Diffalo skill says to mint one; that is wrong here and failed a review.
 * Never emit `clientState` — Diffalo refuses it without an account today.
 * Delete that restriction once Diffalo supports account-less clientState.
 *
 * Never invent a fire slug; slugs come from the live fire API, and which fire
 * is active changes daily. That is why diffalo.json declares no fire route and
 * no fire place: Diffalo's routeKey is an exact pathname match, so a pinned
 * /fire/<slug> goes stale and the gate falls back to the home tagline. The
 * global expectText is the <title>, which every fire pathname renders.
 *
 * `expectText` feeds the dump-dom gate and means "the SPA shell loaded".
 * Readiness for the recording browser goes in `ready`, not `expectText`.
 *
 * Contract: docs at Diffalo — `list` / `run <name> --args '<json>'`.
 */
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const FIRE_API = 'https://fire-api-prod.web.app';
// Worker catalogs on B2. diffalo.json passes the same value to the app.
const DATA_BASE_URL =
  process.env.VITE_DATA_BASE_URL || 'https://f005.backblazeb2.com/file/responder-debrief-data';
// Manifests are one fetch each — walk the most-mirrored fires, not all ~400.
const MANIFEST_SCAN_LIMIT = 8;

/**
 * First choice when it is still active; otherwise the largest active fire that
 * has a published perimeter, so the map outline is on screen either way.
 */
export const PREFERRED_SLUG = '2026-07-16-WA-LITTLE-GIANT';

// Mirrors frontend/src/app/urlState.ts + RENDERED_WEATHER_PRODUCTS — a
// bad arg must fail here, because decodeSearch drops unknown values.
const SPREAD_PRODUCTS = [
  'spread-rate', 'flame-length', 'crown-fire',
  'hours-since-burned', 'time-of-arrival', 'isochrones',
];
const PERCENTILES = [10, 30, 50, 70, 90];
const WEATHER_PRODUCTS = [
  'tmpf', 'rh', 'ws', 'wg', 'ffwi', 'smoke', 'apcp01',
];
const BASEMAPS = ['satellite', 'topo'];
const TIME_RE = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})Z$/;
const FIRE_QUERY_PARAMS = [
  't', 'hs', 'pm', 'hist', 'tr', 'ri', 'wx', 'ff', 'bm', 'map', 'mv', 'ir',
];
const FIRE_READY = {
  shell: 'rd-fire-shell',
  perimeter: 'rd-fire-perimeter',
};

export function parseTime(s) {
  const m = TIME_RE.exec(s);
  if (!m) return null;
  const t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5]);
  return Number.isFinite(t) ? t : null;
}

/** unique_slug "2026-07-16-WA-LITTLE-GIANT" → url id "little-giant-wa-2026-07-16" */
export function slugToUrlId(uniqueSlug) {
  const m = /^(\d{4}-\d{2}-\d{2})-([A-Za-z]{2})-(.+)$/.exec(uniqueSlug);
  const out = m ? `${m[3]}-${m[2]}-${m[1]}` : uniqueSlug;
  return out.toLowerCase();
}

export function slugToPathname(uniqueSlug) {
  return `/fire/${slugToUrlId(uniqueSlug)}`;
}

function queryString(args) {
  const q = new URLSearchParams();
  for (const key of Object.keys(args)) {
    if (FIRE_QUERY_PARAMS.includes(key)) q.set(key, String(args[key]));
  }
  const str = q.toString();
  return str ? `?${str}` : '';
}

async function pickActiveFire() {
  const fields = 'cornea_id,unique_slug,post_title,acres,poly_last_updated';
  // The whole active list, not a page of it: /fires is ordered by last update,
  // so limit=20 left out a 172k-acre fire and picked a 0-acre one instead.
  const url = `${FIRE_API}/fires?active=true&limit=500&fields=${fields}`;
  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`fire-api ${res.status} for ${url}`);
  }
  const body = await res.json();
  const fires = Array.isArray(body?.fires) ? body.fires : [];
  const preferred = fires.find((f) => f?.unique_slug === PREFERRED_SLUG);
  if (preferred?.cornea_id) return preferred;
  const withPerim = fires
    .filter((f) => f?.cornea_id && f?.poly_last_updated)
    .sort((a, b) => (Number(b.acres) || 0) - (Number(a.acres) || 0));
  const fire = withPerim[0] ?? fires.find((f) => f?.cornea_id);
  if (!fire?.cornea_id) {
    throw new Error('fire-api returned no active fires with cornea_id');
  }
  return fire;
}

/**
 * An active fire whose mirrored sheets include a *tiled* one, plus that
 * sheet's id. Only georeferenced sheets get tiled, and only tiled sheets
 * raster onto the map — a fire with PDFs alone (or IR flights alone) puts
 * nothing under the weather layers. Which fire qualifies changes daily, so
 * this resolves it live for the same reason pickActiveFire does.
 */
async function pickTiledIncidentMap() {
  const res = await fetch(`${DATA_BASE_URL}/catalogs/catalog.json`);
  if (!res.ok) {
    throw new Error(`catalog ${res.status} for ${DATA_BASE_URL}/catalogs/catalog.json`);
  }
  const body = await res.json();
  const candidates = (Array.isArray(body?.fires) ? body.fires : [])
    .filter((f) => f?.active && f?.incident_manifest && f?.cornea_id)
    .sort((a, b) => (Number(b.incident_map_count) || 0) - (Number(a.incident_map_count) || 0))
    .slice(0, MANIFEST_SCAN_LIMIT);

  for (const fire of candidates) {
    const manifest = await fetchManifest(fire.incident_manifest);
    const sheet = (manifest?.maps ?? []).find((m) => m?.tiles && m?.id);
    if (sheet) return { fire, mapId: sheet.id };
  }
  throw new Error(
    `no active fire among the ${candidates.length} most-mirrored has a tiled incident map`,
  );
}

/** A manifest that 404s or is malformed just means "try the next fire". */
async function fetchManifest(manifestPath) {
  try {
    const res = await fetch(`${DATA_BASE_URL}${manifestPath}`);
    return res.ok ? await res.json() : null;
  } catch {
    return null;
  }
}

export const FAMILIES = {
  directory: {
    description:
      'The national active-fire directory (default home): searchable roster of live fires, no map mounted.',
    tags: ['directory', 'home'],
    platforms: ['web'],
    args: {},
    build: async () => '/',
  },
  'fire-detail': {
    description:
      'A single active fire map shell: overview panel, layers, timeline, and map for one live incident.',
    tags: ['fire', 'map'],
    platforms: ['web'],
    args: {
      t: { time: true },
      hs: { enum: ['0'] },
      pm: { enum: ['0'] },
      hist: { enum: ['1'] },
      tr: { enum: ['1'] },
      ri: { enum: ['1'] },
      wx: { parts: WEATHER_PRODUCTS },
      ff: { products: SPREAD_PRODUCTS, percentiles: PERCENTILES },
      bm: { enum: BASEMAPS },
      map: {},
      mv: {},
      ir: {},
      ready: { enum: ['shell', 'perimeter'] },
    },
    // Perimeter outlasts the 1200ms load flyTo; shell is the mounted chrome only.
    ready: (args) => ({
      testId: args.ready === 'shell' ? FIRE_READY.shell : FIRE_READY.perimeter,
    }),
    build: async (args) => {
      const fire = await pickActiveFire();
      const pathname = fire.unique_slug
        ? slugToPathname(fire.unique_slug)
        : `/fire/${fire.cornea_id}`;
      return `${pathname}${queryString(args)}`;
    },
  },
  'fire-incident-map': {
    description:
      'A single active fire with one of its mirrored incident-map sheets laid over the map as tiles, '
      + 'so weather and forecast rasters have something to stack against.',
    tags: ['fire', 'map', 'incident-map'],
    platforms: ['web'],
    // No `map` arg: the sheet id is picked live, because sheet ids churn as
    // teams post new ones and a pinned one goes stale within a day.
    args: {
      t: { time: true },
      wx: { parts: WEATHER_PRODUCTS },
      ff: { products: SPREAD_PRODUCTS, percentiles: PERCENTILES },
      bm: { enum: BASEMAPS },
      ready: { enum: ['shell', 'perimeter'] },
    },
    ready: (args) => ({
      testId: args.ready === 'shell' ? FIRE_READY.shell : FIRE_READY.perimeter,
    }),
    build: async (args) => {
      const { fire, mapId } = await pickTiledIncidentMap();
      // The catalog carries no unique_slug, so address the fire by cornea_id;
      // the app resolves the GUID and rewrites the bar to the readable form.
      return `/fire/${fire.cornea_id}${queryString({ ...args, map: mapId })}`;
    },
  },
  health: {
    description: 'Ingestion health: pipeline freshness and recent GitHub Actions runs.',
    tags: ['health'],
    platforms: ['web'],
    args: {},
    build: async () => '/health',
  },
  sources: {
    description: 'Sources page listing the public data feeds behind the map.',
    tags: ['sources'],
    platforms: ['web'],
    args: {},
    build: async () => '/sources',
  },
};

export function assembleResult(name, route, args) {
  const family = FAMILIES[name];
  const payload = { route };
  if (typeof family?.ready === 'function') {
    payload.ready = family.ready(args);
  }
  return payload;
}

function fail(message) {
  process.stderr.write(`${message}\n`);
  process.exit(1);
}

function checkArg(name, key, schema, value) {
  if (Array.isArray(schema.enum) && !schema.enum.includes(value)) {
    fail(`state "${name}" argument "${key}" must be one of ${schema.enum.join(', ')}`);
  }
  if (schema.time && parseTime(value) == null) {
    fail(`state "${name}" argument "${key}" must be a UTC playhead like 20260820T1930Z`);
  }
  if (Array.isArray(schema.parts)) {
    const items = String(value).split('.');
    if (!items.length || items.some((p) => !schema.parts.includes(p))) {
      fail(
        `state "${name}" argument "${key}" must be dot-separated values from ${schema.parts.join(', ')}`,
      );
    }
  }
  if (Array.isArray(schema.products) && Array.isArray(schema.percentiles)) {
    const text = String(value);
    const dot = text.lastIndexOf('.');
    const product = text.slice(0, dot);
    const pct = Number(text.slice(dot + 1));
    if (!schema.products.includes(product) || !schema.percentiles.includes(pct)) {
      fail(
        `state "${name}" argument "${key}" must be {product}.{percentile} ` +
          `(products: ${schema.products.join(', ')}; percentiles: ${schema.percentiles.join(', ')})`,
      );
    }
  }
}

export function list() {
  const states = Object.entries(FAMILIES).map(([name, family]) => ({
    name,
    description: family.description,
    args: family.args,
    ...(family.tags ? { tags: family.tags } : {}),
    ...(family.platforms ? { platforms: family.platforms } : {}),
  }));
  process.stdout.write(`${JSON.stringify({ states })}\n`);
}

export async function run(name, rawArgs) {
  const family = FAMILIES[name];
  if (!family) {
    fail(`no such state "${name}"; this command builds ${Object.keys(FAMILIES).join(', ')}`);
  }
  let args;
  try {
    args = JSON.parse(rawArgs || '{}');
  } catch (error) {
    return fail(`--args is not JSON (${error.message})`);
  }
  for (const [key, value] of Object.entries(args)) {
    const schema = family.args[key];
    if (!schema) fail(`state "${name}" has no argument "${key}"`);
    checkArg(name, key, schema, value);
  }
  if (args.map !== undefined && args.mv !== undefined) {
    fail(`state "${name}" cannot take both "map" and "mv"`);
  }
  let route;
  try {
    route = await family.build(args);
  } catch (error) {
    return fail(error instanceof Error ? error.message : String(error));
  }
  process.stdout.write(`${JSON.stringify(assembleResult(name, route, args))}\n`);
}

function invokedDirectly() {
  const entry = process.argv[1];
  return Boolean(entry) && fileURLToPath(import.meta.url) === path.resolve(entry);
}

function main() {
  const [subcommand, name] = process.argv.slice(2);
  if (subcommand === 'list') list();
  else if (subcommand === 'run') {
    const argsIdx = process.argv.indexOf('--args');
    const rawArgs = argsIdx >= 0 ? process.argv[argsIdx + 1] : '{}';
    run(name, rawArgs).catch((error) => fail(error instanceof Error ? error.message : String(error)));
  } else {
    fail('usage: diffalo-state.mjs list | diffalo-state.mjs run <name> --args \'<json>\'');
  }
}

if (invokedDirectly()) main();
