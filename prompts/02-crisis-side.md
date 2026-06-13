# Prompt 02 — Lane 2: Crisis Side + UI Kit + i18n

You are building the **no-login crisis side** of Waypoint — what a person in distress uses on a cracked screen, maybe low-literacy, maybe not speaking English. Run AFTER the foundation is merged.

**First:**
1. `git pull origin main`, then: `git worktree add ../waypoint-crisis -b lane/crisis`.
2. Read `.claude/rules/accessibility.md` (your acceptance criteria), `.claude/rules/privacy.md` (no login, fuzz on capture, don't ask for PII), `.claude/plans/M1-tonight-loop.md`.

## You OWN (edit only these)

- `src/features/crisis/**` — replace the `CrisisPanel.tsx` stub and build the flow.
- `src/components/kit/**` — the reusable big-tap-target component kit.
- `src/i18n/**` — expand `en.json` / `es.json` with all your strings.

## You CONSUME (import, never edit)

- `src/lib/data/hooks.ts` + `db` (`openNeed`, `useNodes`) — build against `mock` mode.
- `src/lib/geocell.ts` (`getFuzzedLocation`) — for the need's location.
- `useMapController()` from `src/map/MapContext` — call `highlightNodes()`, `pulseBeacon()`, `drawRoute()`, `flyTo()` to drive the map. **Do not edit map code.**
- `useRole()` (panel shows when role === 'crisis').

## Build the *tonight* loop

1. **Crisis home** — the map is already behind you (App shell); your panel is **one giant "I need help" button** (icon + localized word). Nothing competing.
2. **Need tiles** — large icon tiles: bed / food / shower / medical / talk. ≥44px targets, glyph + localized word.
3. **Own words** — after picking a need, let the person add a short free-text note ("me and my dog, nowhere safe tonight"). This text feeds Triage later — capture it on the `Need`.
4. **Open the need** — call `getFuzzedLocation()` then `db.openNeed({type, words, fuzzed_geocell})`. Then `mapController.pulseBeacon(geocell)` and `highlightNodes(matchingNodeIds)` (filter `useNodes()` by type with `capacity_open > 0`, nearest first).
5. **Route + arrival card** — on tapping a highlighted node, `mapController.drawRoute(...)` and show a plain-language, trauma-informed **"what to expect when you arrive"** card. Both languages.
6. **UI kit** — build `BigButton`, `IconTile`, `Card`, etc. in `src/components/kit/` with WCAG AA defaults baked in (contrast, tap size, focus states). Reuse them; Lane 3 may import them too.

## Done when

- In `mock` mode: open app (role=crisis) → "I need help" → pick need → matching nodes light up + beacon pulses on the map → pick one → route draws + arrival card — **with no login**.
- Every string resolves in `en` AND `es`; usable at 200% zoom / 360px width; icon-only controls have `aria-label`s.
- Location is fuzzed before use. `npm run lint && npm run typecheck` pass. Open a PR.

## Hard rules

- **No account/login, no password.** Device only.
- **No user-facing string literals** — everything through i18n.
- **Trauma-informed copy:** "I need help" not "Submit request"; no countdowns, no urgency-shaming, no punishing errors.
- Don't ask for or store legal name / precise location; steer copy away from it.
- Drive the map only through `useMapController()` — never import or edit `src/map` internals.
