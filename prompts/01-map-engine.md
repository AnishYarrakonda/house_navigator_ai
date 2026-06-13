# Prompt 01 — Lane 1: Map Engine

You are building the **map** for Waypoint — the hero of the product. Run this AFTER the foundation is merged to `main`.

**First:**
1. `git pull origin main`, then create your own worktree + branch: `git worktree add ../waypoint-map -b lane/map` (work there).
2. Read `.claude/rules/map.md` (your spec), `.claude/rules/accessibility.md` (contrast, no color-alone), `.claude/rules/privacy.md` (beacons/heatmap use fuzzed cells only), and `.claude/plans/M0-hero-shot.md`, `M3-the-journey.md`, `M4-heatmap.md`.

## You OWN (edit only these)

- `src/map/**` — EXCEPT do not change the `MapController` interface in `src/map/types.ts` or the context shape in `src/map/MapContext.tsx` (those are the contract other lanes call). You replace the **stub MapController implementation** with the real one and replace `src/map/MapView.tsx`.

## You CONSUME (import, never edit)

- `src/types.ts`, `src/lib/data/hooks.ts` (`useNodes`, `useNeeds`, `useJourneys`), `src/lib/geocell.ts`.
- The `MapController` interface — you **implement** every method on it for real.

## Build

1. **`MapView.tsx`** — MapLibre GL JS, full-bleed, **no token/billing**, custom **warm-dark** basemap style, centered on SF. Mount the map and provide the real `MapController` via `MapContext` so other lanes' calls actually do something.
2. **Street layer** — resource pins from `useNodes()`, with capacity label (`3/40`) colored green→amber→red by `capacity_open/capacity_total`; pair color with shape/label (a11y). Implement `highlightNodes()`/`clearHighlights()` (crisis lane calls these to light up matches). Implement `pulseBeacon(geocell)` as an animated `circle` ripple from the **geocell center** (never a precise point).
3. **City layer** — `drawRoute(journeyId, geojson)`/`removeRoute()` using animated GeoJSON `line` layers: completed segments solid+bright, upcoming dotted+dim. On load, auto-draw the seeded journeys from `useJourneys()` so the hero shot works (one route animating across the city; zoom out → many).
4. **Region layer** — `showHeatmap(cells)`/`hideHeatmap()` using MapLibre's built-in `heatmap` layer from already-k-anonymized `HeatCell[]`. `setTimeScrub(hour)` re-queries/filters. (Coordinator lane drives these.)
5. **Zoom behavior** — `setZoomLayer(...)` and/or zoom-threshold logic switching street/city/region emphasis; `flyTo()`.
6. **Perf** — use sources + feature-state updates, not layer rebuilds; throttle animations; keep it smooth on old Android.

## Done when (M0 hero shot is the must-have)

- Boot in `mock` mode: warm-dark SF map fills the screen, pins show colored capacity, and seeded journeys animate as glowing routes; pulling back reveals multiple routes.
- Every `MapController` method is implemented (other lanes depend on them); calling them from the console/devtools visibly affects the map.
- `npm run lint && npm run typecheck` pass. Open a PR to `main`.

## Hard rules

- **Beacon and heatmap geometry come from fuzzed cells only.** Never plot a precise person location — there isn't even a field for it.
- Don't edit anything outside `src/map/`. If you need data the hooks don't provide, add it to your own map code from existing hooks; don't modify `src/lib/data`.
- deck.gl is stretch-only; ship the MVP on built-in MapLibre layers.
