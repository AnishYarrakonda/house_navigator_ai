# Rule: Code Style & Conventions

Lean, hackathon-realistic, but not sloppy where it counts (privacy, a11y, realtime).

## Stack conventions

- **TypeScript everywhere.** `strict` on. No `any` on data crossing the DB ↔ UI ↔ agent boundary — type the §5 tables once and reuse (generate from Supabase where possible: `supabase gen types typescript`).
- **React + Vite + Tailwind.** Function components + hooks. Co-locate component + its styles + its tests.
- **Tailwind for styling.** A small **big-tap-target component kit** for the crisis side (see `accessibility.md`) — build it once, reuse it; don't hand-roll tap targets per screen.
- **i18n:** no user-facing string literals in components — everything through `react-i18next` keys, `en` + `es` (see `accessibility.md`).

## Suggested layout (create as milestones need it)

```
src/
  map/            MapLibre setup, layers (pins/routes/heat/beacons), style
  features/
    crisis/       no-login crisis side (I-need-help, need tiles, route card)
    volunteer/    co-pilot roster, inbound need cards, thread
    coordinator/  zoomed-out heatmap, capacity mgmt, pre-position
  agents/         the four runtime agents (Resource/Triage/Navigator/Foresight) + orchestrator
  lib/
    supabase.ts   client + typed table helpers
    redaction.ts  the chokepoint for all model inputs (see privacy.md)
    geocell.ts    geofuzzing to ~250m grid
  i18n/           react-i18next dictionaries
supabase/
  migrations/     schema + RLS policies
  seed.sql        SF nodes + scripted journeys + simulated capacity
  functions/      Edge Functions (Resource, Foresight)
```

## Boundaries that matter

- **All model inputs go through `lib/redaction.ts`.** Never hand-assemble a prompt from raw rows (see `privacy.md`).
- **All geo capture goes through `lib/geocell.ts`** — fuzz on capture, never store precise points (see `privacy.md`).
- **Map-visible state subscribes to Supabase Realtime**, not local-only state, by M2 (see `map.md`).
- **RLS lives in migrations**, version-controlled — not configured by hand in the dashboard.

## Hygiene

- Run `npm run lint && npm run typecheck && npm test` before declaring a milestone done.
- Keep secrets in `.env` / Supabase env, never committed.
- Small, focused commits per milestone task; branch off `main` for feature work.
