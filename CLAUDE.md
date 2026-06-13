# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What this is

**Waypoint** — a two-sided, map-first web app for the *Housing Dignity* track. A person in crisis finds safety *tonight* and watches their *path home* grow as a glowing route on a living map; a volunteer co-pilot walks that path with them; coordinators see anonymized need as a heatmap. Four Claude-powered runtime agents keep the map true, match needs, grow journeys, and predict overflow — with a human in the loop on anything touching a person.

The repo is currently **greenfield** (only `README.md` + this scaffold). The full product spec, architecture, and milestone plans live under `.claude/` — read them before building.

## The two "agent" concepts (do not conflate)

| | Lives in | Purpose |
|---|---|---|
| **Claude Code subagents** | `.claude/agents/*.md` | Help *build* Waypoint (map, frontend, backend, runtime-agents, privacy review). Invoked via the `Agent` tool. |
| **Waypoint runtime agents** | app code (`src/agents/…`, Edge Functions, triggers) | The four-agent system (Resource / Triage / Navigator / Foresight) that *runs* the live product via the Claude API. |

When the spec says "the Triage Agent," it means a runtime agent — application code, not a Claude Code subagent.

## Toolchain & commands

The chosen stack (see `.claude/rules/` for the why). Once scaffolded, these are the commands:

```bash
npm install              # install deps
npm run dev              # Vite dev server (the map should render first)
npm run build            # production build
npm run lint             # ESLint
npm run typecheck        # tsc --noEmit
npm test                 # Vitest (unit)
npm test -- <pattern>    # run a single test file / name pattern
npx supabase start       # local Supabase (Postgres + Realtime + Studio)
npx supabase db reset    # re-apply migrations + re-run seed.sql
npx supabase functions serve <name>   # run an Edge Function (Resource/Foresight agents) locally
```

> If a command above doesn't exist yet, it hasn't been scaffolded — add it as part of the milestone that needs it (see `.claude/plans/`), don't invent an alternate workflow.

## Architecture big picture

- **The map is the home screen on both sides**, not a tab. One warm-dark MapLibre basemap, three zoom-keyed behaviors: *street* (resource pins + live capacity + beacon pulses), *city* (glowing per-person routes), *region* (k-anonymized heatmap + time scrubber). See `.claude/rules/map.md`.
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
    M0…M5-*.md             ← per-milestone, independently-showable build plans
  rules/                   ← enforceable guardrails (privacy, a11y, map, ai-agents, data, code-style)
  agents/                  ← Claude Code subagents that help build Waypoint
  memory/                  ← project memory (MEMORY.md index + fact files)
  settings.json            ← project Claude Code settings (permission allowlist)
```

## Build order (demo-first)

Build in the order that protects the demo; each milestone is independently showable. Full detail per file in `.claude/plans/`:

- **M0** Hero shot — map + style + seeded nodes + one pre-baked glowing journey.
- **M1** The *tonight* loop — "I need help" → pick need → nodes light up → route.
- **M2** Live sync — volunteer receives beacon, accepts; Supabase Realtime updates both screens.
- **M3** The journey — waypoint model + route that grows; city-zoom many-routes reveal.
- **M4** The heatmap — region-zoom k-anon heat + time scrubber + pre-position drop.
- **M5** Polish — i18n toggle, trauma-informed copy, animations, edge states, privacy explainer.

Always read the relevant `.claude/plans/M*.md` and the rules it references before starting a milestone.
