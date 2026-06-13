# Rule: Waypoint Runtime Agents

These are the **four runtime agents** that run the live product — application code calling the Claude API with tool use. They are **not** Claude Code subagents (those live in `.claude/agents/` and help you build). Shared state is the §5 Postgres tables (a blackboard the agents read/write); Supabase Realtime fans their outputs onto the map.

## Responsible agentic design (the part that lands in a dignity track)

Autonomy is **calibrated to risk**. Memorize this table:

| Agent | Trigger | Autonomy | Touches a person? |
|---|---|---|---|
| **Resource** | scheduled (cron/Edge Fn) | **autonomous** | No — public data only |
| **Foresight** | scheduled (cron/Edge Fn) | **autonomous** | No — aggregate/public only |
| **Triage** | event (Postgres trigger → fn) | **recommends; human confirms** | Yes |
| **Navigator** | event + scheduled | **recommends; person/co-pilot confirm** | Yes |

Hard rules:
- **Human-in-the-loop on anything touching a person.** Triage and Navigator *recommend*; a human confirms before anyone is routed or messaged. **No autonomous action on a vulnerable individual, ever.**
- **Autonomy only on public/aggregate data.** Resource and Foresight run unattended precisely because they never see an identifiable person.
- **No PII to the model.** Agents see aliases, need types, the person's need *words*, and fuzzed cells — never legal names or precise coordinates. Enforced by RLS + the redaction layer (see `privacy.md`). Route every model input through the redaction layer.
- **Every recommendation is explainable.** Each agent returns a **plain-language rationale** shown to the human. Store it alongside the recommendation; never surface a bare ranked list.
- **Low confidence escalates.** A Triage match below a confidence threshold goes to a **human queue** instead of guessing.

## The four agents

### A. Resource — keeps the map true *(autonomous, scheduled)*
Pulls real SF data on a schedule (`data-sources.md`), normalizes messy government records into clean `resource_node` rows, classifies each by need type (bed/food/hygiene/water/medical), writes a plain-language "what to expect" note, flags stale/closed sites. It's an *agent* (not a cron job) because it reasons over inconsistent schemas + free-text.
*Tools:* DataSF SODA fetch, geocoder, `resource_node` upsert.

### B. Triage — matches a need to the right place *(event, HITL)*
Fires when a person opens a need. Reads their own words + constraints ("I have my dog and a 6-year-old, nowhere tonight, can't be split up") and reasons over live capacity, hours, eligibility, distance to rank options **with a written rationale**. The showcase reasoning task — what a SQL `WHERE` can't do. Recommends; a human co-pilot confirms before routing.
*Tools:* query `resource_node`, routing/distance, read `need`.

### C. Navigator — grows the path home *(event + scheduled, HITL)*
Once tonight's need is met, proposes next waypoints (ID → GA/CalFresh → Coordinated Entry housing assessment → …), drafts trauma-informed "what to expect" cards + reminder nudges, surfaces likely program eligibility. Turns triage into a plan. Recommends; person/co-pilot confirm.
*Tools:* read/write `journey` + `waypoint`, reminders, program-eligibility knowledge, drafting.

### D. Foresight — sees the spike before it lands *(autonomous, aggregate-only)*
Continuously watches 311 encampment/homeless-concern reports, the HSH shelter waitlist, the weather forecast, and the app's anonymized heatmap. When signals align (cold/wet front tonight + waitlist climbing + 311 clustering in a district), predicts overflow and posts a pre-positioning alert to coordinators. Allowed to act unattended *because it only ever touches aggregate, public data.*
*Tools:* DataSF 311 + shelter-waitlist fetch, NWS forecast, read anonymized heatmap, post coordinator alert.

## Orchestration

A **thin supervisor** routes events to the right agent and lets them hand off (**Triage → Navigator** when a need closes). Implementation: each agent is a Claude API call with tool use; scheduled agents on cron / Supabase Edge Functions, event agents on a Postgres trigger → function. Keep the supervisor thin — specialists + shared blackboard + realtime fan-out, no monolith.

## Implementation notes

- Use the **latest, most capable Claude model** for reasoning-heavy agents (Triage, Navigator). When in doubt about model IDs/params, consult the `claude-api` skill rather than guessing.
- Define each agent's tools as explicit, narrow tool-use schemas — one job, one toolset.
- Persist: the recommendation, its rationale, its confidence, and the human decision (accepted/overridden) — this is the audit trail that makes the system explainable.
