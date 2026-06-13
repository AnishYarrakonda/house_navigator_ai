# Waypoint — Big Picture & Orchestration Plan

> The master plan. Everything else (`rules/`, `agents/`, the `M*` milestone plans) hangs off this. Read this first, then the milestone you're working on, then the rules it references.

> **Status (2026-06-13):** the build below is **complete** — M0–M5 are all implemented and the app runs end-to-end on seeded data. This file remains the reference for *intent and architecture*; it is no longer a forward to-do list. Current work is a presentation-only front-end revamp to the cobalt × deep-teal **Navigation Map** design system (visual source of truth in `Navigation Map/`), replacing the old warm-amber theme. Where this plan still says "warm-dark," read "cobalt × deep-teal dark."

## The one-liner

A two-sided app where a person in crisis can find safety *tonight* and watch their *path home* take shape on a living map — while volunteers walk that path alongside them instead of dispatching to a dot.

## Why it wins a *dignity* track

The unit of the product is not a *request* and not a *region* — it's a **path home**, rendered as a glowing route that grows one waypoint at a time (reached out → safe tonight → transitional → benefits/ID → job → keys). The map *is* the dignity statement: zoom in, one person being helped now; zoom out, a whole city of paths home.

Four judge questions, answered by design (not bolted on):
- **Tracking vulnerable people?** No — store the *resource node* someone heads to, never live GPS.
- **Usable with no phone plan / account / literacy?** Yes — no-login crisis side, icon-first, multilingual, low-data, QR/short-code onboarding.
- **Does help actually continue?** Yes — one volunteer co-pilots one journey; the relationship persists across crises.
- **Where's the real AI?** A four-agent system runs live ops, human-in-the-loop on every decision touching a person.

## The three roles

- **Person in crisis** (no account) — map + one giant "I need help" button → open a need → routed → paired with a co-pilot → watches their path home grow.
- **Volunteer / co-pilot** — small roster of journeys + nearby inbound need cards → accept → confirm a resource → message → mark the next waypoint.
- **Coordinator / org** (emergent, same app zoomed out) — anonymized heatmap, capacity management, pre-position resources where need is rising.

## System shape

```
            DataSF / NWS (public)              Person (crisis side, no login)
                  │                                     │
                  ▼                                     ▼
   ┌──────────────────────────┐          ┌──────────────────────────────┐
   │ Resource Agent (cron)     │          │ React + MapLibre (map-first)  │
   │ Foresight Agent (cron)    │          │ crisis | volunteer | coord    │
   └────────────┬─────────────┘          └───────────────┬──────────────┘
                │  upsert nodes / post alerts             │ open need / confirm / message
                ▼                                          ▼
   ┌───────────────────────────────────────────────────────────────────┐
   │     Supabase Postgres = shared blackboard  (§5 tables + RLS)        │
   │  person · need · resource_node · journey · waypoint · volunteer · message │
   └───────────────────────────────┬───────────────────────────────────┘
            ▲ recommend (HITL)      │ Realtime fan-out (the live wow)
            │                       ▼
   ┌────────────────────┐    every change streams back onto the map
   │ Triage Agent (event)│   (pins, capacity, beacons, routes, heat)
   │ Navigator Agent     │
   └────────────────────┘
```

**Orchestration:** a thin supervisor routes events to the right agent and lets them hand off (Triage → Navigator when a need closes). Scheduled agents (Resource, Foresight) run on cron / Supabase Edge Functions; event agents (Triage, Navigator) run on a Postgres trigger → function. Each agent is a Claude API call with tool use.

## Data model (lean — see `rules/privacy.md` for the constraints)

`person`(id, display_alias, preferred_language, consent_share_journey, device_session_token — *no real location*) ·
`need`(id, person_id, type, fuzzed_geocell, status, created_at, expires_at) ·
`resource_node`(id, name, type, lat, lng, capacity_total, capacity_open, hours, notes) ·
`journey`(id, person_id, copilot_id, status) ·
`waypoint`(id, journey_id, node_id?, label, order, status, date) ·
`volunteer`(id, name, skills, active) ·
`message`(id, journey_id, sender_role, body, created_at).

Heatmap is **derived**: aggregate `need.fuzzed_geocell` + journey density; **never render a cell with < N people** (k-anonymity).

## Milestones (demo-first; each independently showable)

| Plan | Milestone | The showable moment |
|---|---|---|
| `M0-hero-shot.md` | Map + style + seeded nodes + 1 pre-baked glowing journey | Wows on load even if all else breaks |
| `M1-tonight-loop.md` | "I need help" → need → nodes light up → route | The crisis loop |
| `M2-live-sync.md` | Volunteer gets beacon, accepts; Realtime both screens | "It's actually live" |
| `M3-the-journey.md` | Waypoint model + growing route + city many-routes reveal | The emotional centerpiece |
| `M4-heatmap.md` | Region k-anon heat + time scrubber + pre-position drop | The intelligence/coordinator view |
| `M5-polish.md` | i18n, trauma-informed copy, animations, edges, privacy screen | Demo-ready dignity |

**Stretch (labeled, not MVP):** PWA/offline cache of nearest nodes, deck.gl route glow, real public-data import beyond seed, SMS fallback. Deliberately **no SMS/Twilio in MVP** — in-app + the co-pilot relationship carry it.

## The four runtime agents (detail in `rules/ai-agents.md`)

- **A. Resource** — *autonomous, scheduled.* Pulls real SF data, normalizes → clean `resource_node` rows, classifies by need type, writes "what to expect," flags stale sites. *Tools:* DataSF SODA fetch, geocoder, `resource_node` upsert.
- **B. Triage** — *event, HITL.* Reads a person's own words + constraints, reasons over live capacity/hours/eligibility/distance, ranks options *with a written rationale*. Recommends; human confirms. *Tools:* query `resource_node`, routing/distance, read `need`.
- **C. Navigator** — *event + scheduled, HITL.* Once tonight's need is met, proposes next waypoints (ID → GA/CalFresh → Coordinated Entry → …), drafts trauma-informed cards + nudges, surfaces eligibility. Recommends; person/co-pilot confirm. *Tools:* read/write `journey`+`waypoint`, reminders, eligibility knowledge, drafting.
- **D. Foresight** — *autonomous, aggregate-only.* Watches 311 reports, HSH waitlist, NWS forecast, the app's anonymized heatmap; predicts overflow; posts coordinator pre-positioning alerts. Unattended *because it only touches aggregate public data.* *Tools:* DataSF 311 + waitlist fetch, NWS forecast, read heatmap, post alert.

## Tech stack (hackathon-realistic, map-first)

- **Map:** MapLibre GL JS (no token/billing) over CARTO `dark_all` tiles, themed cobalt × deep-teal dark (Navigation Map design system; was warm-amber); built-in `heatmap` layer; animated GeoJSON `line` for routes; animated `circle` for beacon pulses. *Stretch:* deck.gl glow.
- **Frontend:** React + Vite + TypeScript + Tailwind; big-tap-target kit for the crisis side.
- **Backend/realtime:** Supabase (Postgres + Realtime + RLS). Realtime is the wow with almost no code; RLS enforces privacy.
- **Auth:** Supabase anonymous sessions (crisis side); normal auth (volunteers/orgs).
- **i18n:** react-i18next; ship English + Spanish for the demo.
- **Agent runtime:** Claude API with tool use; scheduled → cron / Edge Function, event → Postgres trigger → function.
- **Demo data:** center on **San Francisco**, seed from real DataSF sources (`rules/data-sources.md`) + 3–4 scripted in-flight journeys + seeded `capacity_open`.

## How to orchestrate a milestone

1. Read this file + the target `M*.md` + the rules it references.
2. If the milestone needs scaffolding that doesn't exist, scaffold it (Vite app, Supabase project, migrations) as the first task of that milestone.
3. Prefer dispatching the matching subagent in `.claude/agents/` for focused work (e.g. `map-engineer` for M0, `supabase-architect` for M2).
4. End each milestone with the **privacy-guardian** subagent review if the work touched data, location, or model inputs.
5. Keep `capacity_open` and any per-bed availability **seeded/simulated** and labeled — SF has no public real-time per-bed feed (state this to judges as competence; see `rules/data-sources.md`).

## Demo script (the target — 2.5 min)

1. Open → glowing route animates across the city: "This is Maria's path home."
2. Crisis side: Maria types "me and my dog, nowhere safe tonight" → **Triage Agent** lights up the *pet-friendly* shelters with open beds, skips dog-unfriendly ones, shows *why*.
3. Volunteer side: co-pilot sees the recommendation, accepts (HITL), confirms a bed (count drops live on both screens), sends a warm message.
4. Growth: mark "safe tonight" complete → **Navigator Agent** proposes the next waypoint; route extends a dotted line to an ID/benefits appointment.
5. Zoom out: region heatmap; **Foresight Agent** already flagged a district (rain + climbing waitlist + clustering 311) → nudged a pre-position → bloom cools. "No one here is locatable — all anonymized aggregate."
6. Zoom to the city of routes: "Every line is a person walking home — with someone beside them, and four agents quietly keeping the map true."

## Taglines

- *Waypoint — the path home, made visible.*
- *Find safety tonight. See the way home.*
- *Nobody walks it alone.*
