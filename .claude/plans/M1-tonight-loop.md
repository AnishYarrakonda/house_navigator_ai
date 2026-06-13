# M1 — The *Tonight* Loop

> **Goal:** Crisis "I need help" → pick need → nearby nodes *with capacity* light up → walking route + "what to expect" card. Local state is fine here.
> **Showable moment:** the full crisis triage loop on one device.
> **Rules:** `accessibility.md` (this is the crisis side — icon-first, i18n, WCAG AA, trauma-informed copy), `privacy.md` (geofuzzing), `map.md`.
> **Best subagent:** `crisis-frontend`.

## Tasks

1. **Crisis home screen.** Map + one giant **"I need help"** button (icon + localized word). Nothing else competing.
2. **Need tiles.** Large icon tiles: bed / food / shower / medical / talk. ≥44px targets, glyph + localized word.
3. **Geofuzz on capture.** Snap the person's location to a ~250m cell via `lib/geocell.ts` **before** anything is stored/used. Never a precise point.
4. **Find & light up nodes.** Filter nodes by need type **with `capacity_open > 0`**, nearest first; animate them lighting up on the map; fire a **beacon pulse ripple** from the *fuzzed* cell.
5. **Route + arrival card.** Tap a node → walking route + a plain-language, trauma-informed "what to expect when you arrive" card. Both translated (en/es).
6. **Build the crisis component kit.** Big-tap-target buttons/tiles reused across the crisis side.

## Done when

- A person can: open app → "I need help" → pick a need → see matching nodes light up → pick one → get a route + arrival card — **with no account/login**.
- All strings resolve in `en` and `es`; screen usable at 200% zoom / 360px.
- Location is fuzzed before use; no precise point stored.

## Notes

- State can be local/in-memory here; M2 moves it to Supabase + Realtime.
- The Triage Agent (reasoning over free-text words) is wired in M2/its own pass — M1 can use a simple capacity+distance filter as the placeholder, but design the need flow to accept the person's **own words** so Triage can slot in.
