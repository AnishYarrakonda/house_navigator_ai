# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Waypoint** — a two-sided, map-first web app for the *Housing Dignity* track. A person in crisis finds safety *tonight* and watches their *path home* grow as a glowing route on a living map; a volunteer co-pilot walks that path with them; coordinators see anonymized need as a heatmap. Four Claude-powered runtime agents keep the map true, match needs, grow journeys, and predict overflow — with a human in the loop on anything touching a person.

The app is **built and running** (typecheck/lint/tests green; deploys to Vercel). Both sides work end-to-end on seeded data: the MapLibre map, the crisis / co-pilot / coordinator panels, the data layer (`mock` in-memory or `live` Supabase, switched by `VITE_DATA_MODE`), and the four runtime agents as `/api/*` endpoints. The full product spec, architecture, and milestone plans live under `.claude/`; the visual design source of truth is `Navigation Map/` (see "Where things live").

**Current focus:** a full front-end revamp to the **Navigation Map** design system — a cobalt × deep-teal dark theme replacing the old warm-amber one. It is a presentation-only reskin (tokens, kit components, map visual layer, panels, layout, loading states); it does **not** touch flows, data hooks, matching/triage logic, the agents, or the `MapController` interface.

## The two "agent" concepts (do not conflate)

| | Lives in | Purpose |
|---|---|---|
| **Claude Code subagents** | `.claude/agents/*.md` | Help *build* Waypoint (map, frontend, backend, runtime-agents, privacy review). Invoked via the `Agent` tool. |
| **Waypoint runtime agents** | app code (`api/*.ts` serverless functions + `api/_lib/`) | The four-agent system (Resource / Triage / Navigator / Foresight) that *runs* the live product via the Claude API. |

When the spec says "the Triage Agent," it means a runtime agent — application code, not a Claude Code subagent.

## Toolchain & commands

The chosen stack (see `.claude/rules/` for the why). These commands exist today:

```bash
npm install              # install deps
npm run dev              # Vite dev server (the map renders first)
npm run build            # production build (tsc -b && vite build)
npm run lint             # ESLint
npm run typecheck        # tsc -b && tsc --noEmit -p api/tsconfig.json (app + api)
npm test                 # Vitest (unit), runs once
npm test -- <pattern>    # run a single test file / name pattern

# Helper scripts (tsx; read .env.local). Live-mode (Supabase) only.
npx tsx scripts/check-supabase.ts   # "doctor": env set?, host reachable, table row counts
npx tsx scripts/seed-live.ts        # seed the hosted DB (mirrors supabase/seed.sql)
npx tsx scripts/test-datasf.ts      # smoke-test the DataSF feeds the Resource agent uses
```

> **Data modes.** Default `VITE_DATA_MODE=mock` runs the whole app on an in-memory data layer — no backend, no keys needed. Set it to `live` to use hosted Supabase + Realtime (requires the `.env.local` keys; see `.env.example`).
>
> **Supabase is hosted**, applied via the SQL editor — `supabase/schema.sql` then `supabase/seed.sql` (or the concatenated `supabase/setup.sql`). RLS is intentionally **off** for the demo (`supabase/fix-rls.sql` disables it; production posture documented in the schema header). There is no local Supabase CLI workflow.
>
> **Agents.** `api/*.ts` are web-signature serverless functions (Vercel). Model is centralized in `api/_lib/anthropic.ts` (`DEFAULT_MODEL`, currently Haiku for cheap testing; override with `WAYPOINT_MODEL`). They are reachable endpoints — not yet auto-triggered by cron or a Postgres trigger, and the crisis/volunteer UI currently uses a fast client-side triage heuristic, not the Claude `/api/triage` agent.

## Architecture big picture

- **The map is the home screen on both sides**, not a tab. One cobalt × deep-teal **dark** MapLibre basemap (the Navigation Map theme), three zoom-keyed behaviors: *street* (resource pins + live capacity + beacon pulses), *city* (glowing per-person routes), *region* (k-anonymized heatmap + time scrubber). See `.claude/rules/map.md`.
- **Supabase Postgres is the shared blackboard.** The §5 tables (`person`, `need`, `resource_node`, `journey`, `waypoint`, `volunteer`, `message`) are read/written by both the UI and the runtime agents. **Supabase Realtime fans every change onto the map** — that live update *is* the demo's wow, so prefer DB-driven state over local-only state for anything map-visible.
- **RLS + a redaction layer are the privacy enforcement**, not an afterthought. No PII (legal name, precise GPS) ever reaches a model or a volunteer. See `.claude/rules/privacy.md`.
- **Four runtime agents, autonomy calibrated to risk.** Resource & Foresight run unattended (public/aggregate data only); Triage & Navigator *recommend* and a human confirms. Every recommendation carries a plain-language rationale. See `.claude/rules/ai-agents.md`.

## Non-negotiable invariants

These are what the dignity track judges will probe. Violating one breaks the product's core claim — treat them as hard constraints, not preferences:

1. **No live tracking.** Store the *node a person is heading to*, never their GPS trail. (`rules/privacy.md`)
2. **Geofuzzing.** Need beacons snap to a ~250m grid cell; exact meetup only on mutual accept.
3. **k-anonymity.** Never render a heatmap cell with fewer than N (=5) signals.
4. **No PII to the model.** Agents see aliases, need types, fuzzed cells — never legal names or precise coordinates.
5. **Human-in-the-loop on anything touching a person.** Triage/Navigator recommend; a human confirms before routing or messaging.
6. **No account barrier on the crisis side.** Device-session token, not email/password.
7. **Icon-first, multilingual, low-data, WCAG AA, trauma-informed copy** on the crisis side. (`rules/accessibility.md`)

## Where things live

```
CLAUDE.md                  ← you are here
.claude/
  plans/
    BIG_PICTURE.md         ← master orchestration plan; read this first
    M0…M5-*.md             ← per-milestone build plans (the original build, now shipped)
  rules/                   ← enforceable guardrails (privacy, a11y, map, ai-agents, data, code-style)
  agents/                  ← Claude Code subagents that help build Waypoint
  memory/                  ← project memory (MEMORY.md index + fact files)
  settings.json            ← project Claude Code settings (permission allowlist)
Navigation Map/            ← visual design source of truth (cobalt × deep-teal dark)
  README.md                ←   design system overview (fonts, tokens, accent system)
  tokens/tokens.css        ←   all --wp-* CSS custom properties + Tailwind mirror
  components/*.dc.html      ←   8 component mockups (Button, CapacityChip, PlaceCard, …)
  screens/*.dc.html         ←   CrisisHome / Copilot / Coordinator full-screen mockups
src/
  map/                     ← MapLibre setup, style, layers, visuals (engine.ts, style.ts)
  features/{crisis,volunteer,coordinator}/   ← the three role UIs
  components/kit/          ← shared big-tap-target component kit
  lib/{data,datasf,…}      ← data layer (mock|supabase), DataSF feeds, redaction, geocell
  i18n/                    ← react-i18next en/es dictionaries
  tokens.css               ← design tokens imported at app root
api/                       ← runtime agents: resource/triage/navigator/foresight + supervisor
  _lib/                    ← shared agent runtime (anthropic, agent loop, redaction, supabase-admin)
supabase/                  ← schema.sql, seed.sql, setup.sql, fix-rls.sql (hosted; applied by hand)
scripts/                   ← check-supabase, seed-live, test-datasf (tsx helpers)
```

## Build order (demo-first) — shipped

The original build followed these milestones; **all are implemented** and run on seeded data. The `.claude/plans/M*.md` files remain the reference for *what each piece is meant to do* and the invariants behind it — read the relevant one before changing that area.

- **M0** Hero shot — map + style + seeded nodes + one pre-baked glowing journey.
- **M1** The *tonight* loop — "I need help" → pick need → nodes light up → route.
- **M2** Live sync — volunteer receives beacon, accepts; Supabase Realtime updates both screens.
- **M3** The journey — waypoint model + route that grows; city-zoom many-routes reveal.
- **M4** The heatmap — region-zoom k-anon heat + time scrubber + pre-position drop.
- **M5** Polish — i18n toggle, trauma-informed copy, animations, edge states, privacy explainer.

**Now:** the front-end revamp to the Navigation Map design system (cobalt × deep-teal). It's a presentation-only reskin across the kit, map visual layer, panels, layout, loading states, and i18n — flows, data hooks, matching/triage, agents, and the `MapController` interface are frozen. The known visible bug it fixes: resource pins rendering as full-width capacity bars instead of an icon badge + capacity pill.

> **Theme note.** Docs may mention the original **warm-amber** theme as history — it has been replaced by the **cobalt × deep-teal dark** Navigation Map theme. Where capacity colors say "green/amber/red," that's the open/filling/full *state* palette (`#4cc38a`/`#d8b65c`/`#e36a7d`), which is unchanged.
