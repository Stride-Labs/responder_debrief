# Diffalo review scaffolding

What we learned trying to film a fire-page review, and what to build so the next
one records on the first attempt.

Written after the "purple perimeter + 2x scrubber" review, which took six runs to
start recording.

## What broke, in order

**1. A fake account looks like login.**
`scripts/diffalo-state.mjs` returned `{ route, account }`. This app has no
sign-in. Diffalo saw an account and required a sign-in command, so every fire
story failed before a frame was recorded:

> state "fire-detail" returned an account, but no sign-in command is configured.

**2. The directory ready-check was applied to the fire page.**
`recordable.expectText` is the home tagline. A fire URL never paints that
sentence, so the recorder waited 90s and gave up:

> never rendered "Wildfire situational awareness for responders" after 90s

**3. The first live fire is a bad review fixture.**
`/fires?active=true&limit=20` sorts by last updated. We landed on Chicken:
0 acres, no perimeter. Even a perfect jump would have filmed an empty map.

**4. A fire URL is not a loaded fire.**
`/fire/<slug>` first renders a resolving shell (see `App.tsx`) until the national
fires index arrives and the slug resolves to a `cornea_id`. `FireMapView` — the
map, perimeter outline, timeline Play button, "Acres", "All fires" — mounts only
after that. Waiting on "Acres" or "All fires" timed out for the same reason.

**5. Three sources of truth drifted.**
`recordable.places.fire`, `recordable.routes["/fire/…"]`, the state command's
returned `route`, and each story's `startRoute` in `brief.json` must be the same
path. When they were not, Diffalo applied the directory ready-check to the fire
URL.

**6. The generic Diffalo skill is wrong for this repo.**
It says to make a new family's `run` "mint a fresh account". Doing that is
exactly failure 1. This app has no accounts.

## What has to be true

Diffalo does three separate jobs, and we kept conflating them:

| Job | What it needs |
| --- | --- |
| Jump | A route Diffalo can open |
| Ready | Painted text that exists *only* when that screen is really up |
| State | The data that screen needs — a real fire with a perimeter, not a login |

For this app specifically:

- Return `{ route }` only. Never `account`.
- Home and fire are different ready states. Home can use the tagline; fire cannot.
- Ready text must not be "Responder Brief 2". That string is in `<title>`, in the
  OG meta tags, and on the resolving placeholder — it passes before the map exists.
- Pick the review fire for the camera, not the newest incident: it needs a
  published perimeter and enough acres for the outline to read on screen.
- Slug deep links wait on the network, so the recorder starts too early unless the
  ready text appears only after `FireMapView` mounts.
- `place` + state `route` + `startRoute` + `routes[path]` must be one URL.
- Braced fire ids in the path (`{GUID}` → `%7B…%7D`) fight the URL bar. Prefer
  slugs with no special characters.

## What is still fragile

The pin that finally recorded — `/fire/little-giant-wa-2026-07-16` with
`expectText: "Responder Brief 2"` — starts a video but does **not** guarantee the
outline or the timeline are on screen when the clip begins. That string is in the
document head, so the check can pass on the loading shell. Little Giant will also
eventually leave the active list, at which point place, route, and state disagree
again.

Treat the current setup as "it recorded", not "it recorded the right frame".

## Plan

Three layers, in this order. A later layer does not help while an earlier one is
still wrong.

### 1. One stable fire URL for reviews

Add a review-only path the app always understands, e.g. `/fire/review`, which
selects a known-good fire immediately from a baked id rather than "first active".
Same URL every time, no slug wait, no `%7B…%7D` encoding.

Then in `diffalo.json`:

- `places.fire` → `/fire/review`
- `routes["/fire/review"].expectText` → the fire-ready string from step 2
- state family `fire-detail` → always returns `/fire/review`

Stories then only name `state: fire-detail` and `place: fire`. Nobody invents a
live slug.

### 2. Ready text that means "the map is up"

Paint a unique string only after the fire shell has mounted — the back control's
"All fires", or a dedicated marker once the perimeter source has data.

Rules:

- The resolving placeholder must not contain that string.
- `index.html` title and meta must not contain that string.
- Fire `expectText` must be that string, not the home wordmark.

Until that string exists, Diffalo should refuse to record. That is the point.

For outline stories, go further: do not paint the ready marker until the selected
perimeter is actually on the map, or the clip opens on a blank basemap.

### 3. A state command that cannot lie

Keep `scripts/diffalo-state.mjs`, but constrain it:

- `run` returns `{ route }` only, never `account`.
- `fire-detail` only ever returns `/fire/review`.
- `list` stays the four families: directory, fire-detail, health, sources.
- Add `node scripts/diffalo-state.mjs doctor`, which loads `/`, `/health`,
  `/sources`, and `/fire/review` and asserts each route's ready text. It fails if
  the fire route is still showing the placeholder.

Run doctor before `diffalo review --brief`. A failing doctor means no recording.

Put these rules in the state script header and in a Cursor rule, so the next agent
does not mint an account or point `startRoute` at a random live fire.

## What not to do

- Do not make the resolving shell paint "Acres" or "All fires" just to satisfy the
  ready-check.
- Do not keep pinning whatever the fire API returns first.
- Do not treat a successful review URL as proof the story filmed the right frame.

## Done when

A fire-page review, run by an agent with no memory of this session:

1. runs doctor and it passes,
2. runs `--agent` and writes stories using only `fire-detail` + `place: fire`,
3. runs `--brief` once and records the map with the perimeter visible.

No second guess between fires, no account object, no 90s miss on the home tagline.
