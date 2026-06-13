# M0 — The Hero Shot

> **Goal:** Map renders with the cobalt × deep-teal dark style (Navigation Map design system; originally built warm-amber) + seeded nodes + **one pre-baked glowing journey**. If everything else breaks, this alone wows on load.
> **Showable moment:** open the app → a luminous route animates across SF.
> **Rules:** `map.md`, `accessibility.md` (contrast), `data-sources.md` (seed).
> **Best subagent:** `map-engineer`.

## Tasks

1. **Scaffold the app.** `npm create vite@latest` (React + TS), add Tailwind, ESLint, Vitest, `react-i18next`. Wire `npm run dev/build/lint/typecheck/test`. Update `CLAUDE.md` if any command differs.
2. **MapLibre + dark style.** Full-bleed map as the home screen (not a tab), centered on San Francisco. Cobalt × deep-teal dark basemap (Navigation Map theme; see `map.md`).
3. **Seed resource nodes (static for now).** A handful of real-ish SF nodes (shelter/food/hygiene/clinic/charging) as GeoJSON; render as pins with capacity labels (`3/40`) colored green→amber→red. Pair color with label (a11y).
4. **One pre-baked glowing journey.** A GeoJSON `line` route across the city: completed segments solid+bright, upcoming dotted+dim. Animate it drawing on load.
5. **Polish the load.** The "oh, nice" beat: route animates in within ~2s of load.

## Done when

- `npm run dev` opens to a cobalt × deep-teal dark SF map with pins + one animated glowing route.
- No console errors; works at 360px width; pins legible (contrast ≥ 4.5:1).
- `npm run lint && npm run typecheck` clean.

## Notes

- Data can be static/local here — Realtime comes in M2. Keep node shapes matching the `resource_node` model so M1/M2 don't re-type them.
- Don't add deck.gl yet (stretch). Built-in MapLibre layers only.
