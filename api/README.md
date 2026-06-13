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

## Status

Stub only. Lane 4 adds the agent endpoints, the thin supervisor, and the
DataSF / NWS fetchers here.
