# Prompt 00 — Foundation (run FIRST, by one person, then merge to `main`)

You are scaffolding **Waypoint** for a 7–8 hr hackathon. Read `.claude/plans/BIG_PICTURE.md`, `.claude/rules/code-style.md`, `.claude/rules/privacy.md`, and `prompts/README.md` first. Your job is to create the **scaffold + every shared contract** so four teammates can then build in parallel without ever editing the same file. Keep it lean — this should take ~30–45 min. Do the work directly on `main` (or a `foundation` branch you merge immediately); the other four lanes branch off your result.

## 1. Scaffold

- Vite + React + TypeScript app at repo root. Add Tailwind, ESLint, Vitest, `react-i18next`, `maplibre-gl`, `@supabase/supabase-js`, `@anthropic-ai/sdk`.
- Wire `npm run dev/build/lint/typecheck/test` in `package.json`. Confirm `npm run lint && npm run typecheck` pass on the empty scaffold.
- Create `.env.example` exactly as documented in `prompts/README.md` (VITE_DATA_MODE, VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, ANTHROPIC_API_KEY) and add `.env` to `.gitignore`.
- Center config on San Francisco (lat 37.7749, lng -122.4194).

## 2. Shared types — `src/types.ts`

Define and export the §5 model as TS types (use them everywhere): `NeedType = 'bed'|'food'|'hygiene'|'medical'|'talk'`, `Role = 'crisis'|'volunteer'|'coordinator'`, plus `Person, Need, ResourceNode, Journey, Waypoint, Volunteer, Message` matching `.claude/plans/BIG_PICTURE.md` §data-model. **No field for a person's real coordinates** — only `fuzzed_geocell` and target node ids (see `privacy.md`).

## 3. Data-layer interface + mock — `src/lib/data/`

This is the contract all UI lanes depend on. Define:
- `src/lib/data/types.ts` — a `DataLayer` interface with the methods the app needs, e.g.:
  `getNodes(): Promise<ResourceNode[]>`, `subscribeNodes(cb)`, `getNeeds()`, `subscribeNeeds(cb)`, `openNeed(input): Promise<Need>`, `claimNeed(id, volunteerId)`, `confirmResource(needId, nodeId)` (decrements capacity), `getJourneys()`, `subscribeJourneys(cb)`, `addWaypoint(...)`, `completeWaypoint(id)`, `getMessages(journeyId)`, `subscribeMessages(journeyId, cb)`, `sendMessage(...)`, `getHeatmapCells(opts): Promise<HeatCell[]>` (already k-anonymized), `getForesightAlerts()`. Each `subscribe*` returns an unsubscribe fn.
- `src/lib/data/mock.ts` — a full in-memory implementation seeded with **~12 SF resource nodes**, **3–4 scripted in-flight journeys** with waypoints, a couple of open needs, and simulated `capacity_open`. Subscriptions fire on local mutations (use a tiny event emitter) so the UI feels live in mock mode. This must make the whole app demoable with NO backend.
- `src/lib/data/supabase.ts` — **stub only** that throws `Not implemented (Lane 4)` for now. Lane 4 will fill this. (Create the file so Lane 4 doesn't have to touch the index.)
- `src/lib/data/index.ts` — exports `const db: DataLayer` chosen by `import.meta.env.VITE_DATA_MODE` (`'live'` → supabase impl, else mock).
- `src/lib/data/hooks.ts` — React hooks wrapping `db`: `useNodes()`, `useNeeds()`, `useJourneys()`, `useMessages(journeyId)`, `useForesightAlerts()` (each returns data + loading and auto-subscribes/cleans up).

## 4. Privacy primitives (cheap, keep them — they're the demo's dignity proof)

- `src/lib/geocell.ts` — `toGeocell(lat, lng): string` snapping to a ~250m grid, and `geocellCenter(cell): [lng,lat]`. **Fuzz on capture.** Export `getFuzzedLocation()` that reads the browser geolocation (with a hard-coded SF fallback for the demo) and returns ONLY the geocell, never raw coords.
- `src/lib/redaction.ts` — `redactForModel(input)` that strips anything but alias, need type, the person's free-text words, fuzzed cell, and resource data. All `/api/*` agent calls (Lane 4) must route through this. Add a one-line doc comment pointing to `.claude/rules/privacy.md`.

## 5. Role toggle (no auth) — `src/lib/useRole.ts`

A `RoleProvider` + `useRole()` returning `{ role, setRole }`, initialized from `?role=` query param, default `'crisis'`. Persist to `localStorage`. No passwords, no Supabase auth.

## 6. MapController contract — `src/map/types.ts` + `src/map/MapContext.tsx`

So crisis/volunteer/coordinator lanes drive the map WITHOUT editing map code:
- `src/map/types.ts` — a `MapController` interface: `flyTo(opts)`, `setZoomLayer('street'|'city'|'region')`, `highlightNodes(ids: string[])`, `clearHighlights()`, `pulseBeacon(geocell: string)`, `drawRoute(journeyId, geojson)`, `removeRoute(journeyId)`, `showHeatmap(cells: HeatCell[])`, `hideHeatmap()`, `setTimeScrub(hour: number)`.
- `src/map/MapContext.tsx` — a React context exposing `useMapController(): MapController`, plus a **no-op stub implementation** so the app compiles before Lane 1 lands. Lane 1 replaces the stub with the real one.

## 7. App shell — `src/App.tsx` + stub panels

- `src/App.tsx` — renders the **full-bleed map as the home screen** (import `<MapView/>` from `src/map`), an overlay **role toggle** (top corner), and a role-based panel slot: `crisis → <CrisisPanel/>`, `volunteer → <VolunteerPanel/>`, `coordinator → <CoordinatorPanel/>`. Wrap in `RoleProvider`, `MapProvider`, and i18n.
- Create **stub component files** each lane will replace (so App.tsx never needs editing again):
  - `src/map/MapView.tsx` (stub: a div saying "map") — Lane 1
  - `src/features/crisis/CrisisPanel.tsx` (stub) — Lane 2
  - `src/features/volunteer/VolunteerPanel.tsx` + `src/features/coordinator/CoordinatorPanel.tsx` (stubs) — Lane 3
- `src/i18n/` — react-i18next init + `en.json`/`es.json` with a handful of starter keys. Lane 2 expands these (Lane 2 owns `src/i18n`).

## 8. Backend stubs so Lane 4 has a home

- `supabase/schema.sql` — empty file with a header comment (Lane 4 fills).
- `api/` — `api/_lib/anthropic.ts` stub (reads `ANTHROPIC_API_KEY`) and a `README` noting agents go here. (Lane 4 fills.)

## Done when

- `VITE_DATA_MODE=mock npm run dev` boots: a placeholder map fills the screen, the role toggle switches between three stub panels, no console errors.
- `npm run lint && npm run typecheck` pass.
- All shared contracts (`types.ts`, `lib/data/*`, `geocell`, `redaction`, `useRole`, `map/types.ts`, `MapContext`, stub panels) exist and are imported by `App.tsx`.
- Commit + push to `main`. Tell teammates to `git pull` before branching.

## Hard rules

- Keep it minimal — you are unblocking 4 people, not building features. No styling beyond what's needed to prove the shell works.
- Every shared file you create here is **frozen** for the lanes — design the interfaces so they don't need to change. If unsure about a method signature, add it; extra unused methods are cheaper than a mid-hackathon contract change.
