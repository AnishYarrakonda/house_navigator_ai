# Prompt 04 — Lane 4: Backend (Supabase) + Runtime Agents

You make Waypoint **real**: the Supabase implementation behind the data-layer interface, the schema/seed, and the four Claude-powered runtime agents behind `/api/*`. Everything the other three lanes built against `mock` must work when `VITE_DATA_MODE=live`. Run AFTER the foundation is merged.

**First:**
1. `git pull origin main`, then: `git worktree add ../waypoint-backend -b lane/backend`.
2. Read `.claude/rules/ai-agents.md` (the autonomy-vs-risk table is law), `.claude/rules/privacy.md` (no PII to the model — route everything through `lib/redaction`), `.claude/rules/data-sources.md` (SF feeds), `.claude/plans/M2-live-sync.md`, `M4-heatmap.md`. For Claude model IDs/params/tool-use, invoke the `claude-api` skill — don't guess.

## You OWN (edit only these)

- `supabase/**` — `schema.sql`, `seed.sql`.
- `src/lib/data/supabase.ts` — the real `DataLayer` implementation (fills the foundation's stub). **Match the interface in `src/lib/data/types.ts` exactly — do not change the interface.**
- `api/**` — the serverless agent endpoints.

## You CONSUME (import, never edit)

- `src/lib/data/types.ts` (the contract you implement), `src/types.ts`, `src/lib/geocell.ts`, `src/lib/redaction.ts`.

## Build — Supabase data layer

1. **`schema.sql`** — the §5 tables (`person, need, resource_node, journey, waypoint, volunteer, message`). **No real-coords column.** **Skip RLS** (hackathon scope — document it as the production story in a comment). Enable Realtime by adding the tables to the `supabase_realtime` publication.
2. **`seed.sql`** — ~12 real SF resource nodes (use `.claude/rules/data-sources.md` — you may pre-fetch DataSF Pit Stops `mr6h-cr3u` + bathrooms `sxtt-wsyn` into the seed) + 3–4 scripted in-flight journeys + **simulated `capacity_open`** (comment it as simulated).
3. **`src/lib/data/supabase.ts`** — implement every `DataLayer` method with `@supabase/supabase-js`, including `subscribe*` via Realtime channels. `getHeatmapCells()` must return **k-anonymized** cells (drop any cell with < 5 signals **in the query/derivation**). `confirmResource` decrements `capacity_open`.

## Build — Runtime agents (`/api/*`, server-side, key never in browser)

Prioritize for 8 hrs: **Triage > Foresight > Navigator > Resource.**

4. **`api/triage`** (the showcase, HITL) — input: a need's words + constraints + candidate nodes. **Route input through `redactForModel` first.** Claude ranks nodes over capacity/hours/eligibility/distance and returns options **with a plain-language rationale** + a confidence. Low confidence → flag for the human queue. Persist the recommendation+rationale on the need so Lane 3 can render it. **Recommends only — never routes anyone.**
5. **`api/foresight`** (autonomous, aggregate-only) — pull 311 (`vw6y-z8j6`), HSH waitlist (`w4sk-nq57`), NWS forecast (`api.weather.gov`) + the anonymized heatmap; when signals align, write a coordinator pre-positioning alert. Safe to run unattended **because it only touches aggregate public data.**
6. **`api/navigator`** (HITL, lighter) — given a journey, propose the next waypoint(s) + a trauma-informed "what to expect" draft. Recommends; person/co-pilot confirm.
7. **`api/resource`** (run-once to seed is fine for the demo) — fetch + normalize DataSF into `resource_node` rows with a "what to expect" note. "Scheduled in production."
8. A **thin supervisor** is enough: Triage on need-open, Navigator on need-close. Make the Triage→Navigator handoff observable (log it).

## Done when

- `VITE_DATA_MODE=live`: the existing UI (all three lanes) works against real Supabase — pins load, opening a need writes a row, confirming a bed decrements capacity **live across two browser windows** via Realtime.
- `POST /api/triage` returns ranked options + rationale + confidence; `/api/foresight` produces an alert from real-ish signals.
- Verify no PII reaches any model call (everything goes through `redactForModel`). `npm run lint && npm run typecheck` pass. Open a PR.

## Hard rules

- **Human-in-the-loop on anything touching a person** — Triage/Navigator only recommend.
- **No PII to the model** — `redactForModel` is the only path to a prompt; agents see aliases, need types, words, fuzzed cells.
- **Implement the interface exactly** — if you think the interface is missing something, add a method to `types.ts` ONLY after pinging the foundation owner; changing signatures breaks the other three lanes.
- Anthropic key is server-side only (no `VITE_` prefix).
