# `/api` — Waypoint runtime agents (Lane 4)

Server-side home for the four **runtime agents** (not Claude Code subagents):

| Agent | Trigger | Autonomy | Touches a person? |
|---|---|---|---|
| **Resource** | scheduled | autonomous | No — public data only |
| **Foresight** | scheduled | autonomous | No — aggregate/public only |
| **Triage** | event | recommends; human confirms | Yes |
| **Navigator** | event + scheduled | recommends; person/co-pilot confirm | Yes |

See `.claude/rules/ai-agents.md`.

## Rules for code in here

- **All model inputs go through `src/lib/redaction.ts`.** Never hand-assemble a
  prompt from raw rows. No PII (legal name, precise GPS) ever reaches the model.
- **Human-in-the-loop** on anything touching a person — Triage/Navigator only
  *recommend*; a human confirms before routing or messaging.
- Each agent returns a **plain-language rationale** + confidence; persist the
  recommendation, rationale, confidence, and the human decision (audit trail).
- Use `getAnthropic()` from `_lib/anthropic.ts`; `ANTHROPIC_API_KEY` is
  server-side only (never `VITE_`-prefixed).
- Scheduled agents run on cron / Supabase Edge Functions; event agents on a
  Postgres trigger → function. Keep the orchestrator thin.

## Endpoints (Lane 4)

| Route | Agent | Autonomy | Input |
|---|---|---|---|
| `POST /api/triage` | Triage | recommends (HITL) | `{ needId }` or `{ person, need, resources }` → ranked options + rationale + confidence; persisted on the need (`triage_*`). Low confidence → `status: "queued"`. |
| `POST /api/navigator` | Navigator | recommends (HITL) | `{ journeyId }` or `{ alias, waypoints }` → proposed next waypoint(s) + a trauma-informed "what to expect" card. Does not write to the journey. |
| `GET\|POST /api/foresight` | Foresight | autonomous | aggregate signals (311 / HSH waitlist / NWS / anon heatmap) → posts a `foresight_alert` when signals align. |
| `GET\|POST /api/resource` | Resource | autonomous | run-once seed: fetch + normalize DataSF (Pit Stops, bathrooms) → `resource_node` rows (capacity_open SIMULATED). |
| `POST /api/supervisor` | thin router | — | `{ type: "need.open"\|"need.close", needId\|journeyId }` → routes to Triage / Navigator; logs the Triage→Navigator handoff. |

Shared helpers live in `_lib/` (Anthropic client, tool-use runner, Supabase
admin client, HTTP helpers, DataSF/NWS signal fetchers). All four reasoning
agents return their result via a forced "submit" tool, so output is structured
and persistable (the explainability audit trail).

Handlers use the Web-standard `(Request) => Response` signature (Vercel Node
runtime / most serverless platforms — no framework dependency). Typecheck the
`/api` code in isolation with `npx tsc --noEmit -p api/tsconfig.json`.
