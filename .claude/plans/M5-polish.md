# M5 — Polish (demo-ready dignity)

> **Goal:** Multilingual toggle, trauma-informed copy pass, pulse animations, empty/edge states, the privacy explainer screen.
> **Showable moment:** the whole 2.5-min demo script runs end-to-end, smooth and dignified.
> **Rules:** `accessibility.md`, `privacy.md` (explainer must be accurate), `map.md`.
> **Best subagents:** `crisis-frontend`, `map-engineer`; finish with `privacy-guardian`.

## Tasks

1. **Multilingual toggle** surfaced on the first screen (en/es); verify every string resolves, including agent-drafted cards.
2. **Trauma-informed copy pass.** Sweep all user-facing copy against `accessibility.md`: "I need help" not "Submit request," no countdowns, no urgency-shaming.
3. **Animations.** Beacon pulse ripples, route glow/draw, smooth zoom transitions; keep cheap for old Android.
4. **Empty / edge states.** No nearby capacity, expired beacon, no journeys yet, agent low-confidence → human queue, weak signal / offline degrade.
5. **Privacy explainer screen.** Plain-language: no tracking, geofuzzing, k-anonymity, consent-owned journey, expiring beacons, no-login. Must match what the code actually does — have `privacy-guardian` verify.
6. **Demo dress rehearsal.** Walk the §10 script (Maria + dog → Triage → co-pilot confirm → Navigator next waypoint → zoom-out heatmap + Foresight → city of routes). Fix anything that stutters.

## Done when

- The full demo script runs without dead ends; both languages work; the privacy explainer is accurate.
- `npm run lint && npm run typecheck && npm test` clean.

## Stretch (only if time; label as stretch to judges)

- PWA / offline cache of nearest nodes.
- deck.gl route glow on top of MapLibre.
- Real public-data import beyond the seed (211/HUD feeds).
- SMS fallback (deliberately not MVP).
