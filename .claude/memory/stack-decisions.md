---
name: stack-decisions
description: Waypoint's chosen toolchain and the deliberate calls behind it
metadata:
  type: project
---

Chosen stack for Waypoint (hackathon-realistic, map-first):
- **Map:** MapLibre GL JS (no token/billing), custom warm-dark style; built-in `heatmap`, animated GeoJSON `line` (routes), animated `circle` (beacons). deck.gl is stretch-only.
- **Frontend:** React + Vite + TypeScript + Tailwind; reusable big-tap-target kit for the crisis side.
- **Backend/realtime:** Supabase (Postgres + Realtime + RLS). Realtime fan-out onto the map is the demo's wow; RLS enforces privacy.
- **Auth:** Supabase anonymous sessions (crisis side, no login) + normal auth (volunteers/orgs).
- **i18n:** react-i18next, English + Spanish.
- **Runtime agents:** Claude API with tool use — scheduled (Resource, Foresight) on cron/Edge Functions, event (Triage, Navigator) on Postgres trigger → function.

Deliberate calls (defend to judges):
- **No SMS/Twilio in MVP** — in-app + the co-pilot relationship carry it; SMS is a labeled stretch.
- **`capacity_open` is seeded/simulated** — SF publishes no public real-time per-bed feed (it's in HSH/ONE System HMIS). Real shelter *locations* + real demand data (311, waitlist) are used; live bed counts would come from an HSH integration in production. Stated plainly = competence, not weakness.

Two distinct "agent" concepts: Claude Code **subagents** (`.claude/agents/`, help build) vs Waypoint **runtime agents** (app code, run the product). See [[project-overview]] and [[dignity-invariants]].
