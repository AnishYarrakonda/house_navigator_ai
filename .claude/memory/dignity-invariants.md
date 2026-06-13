---
name: dignity-invariants
description: The non-negotiable privacy/accessibility/HITL constraints that win (or lose) the dignity track
metadata:
  type: project
---

Waypoint's pitch rests on these hard constraints. Violating one breaks the core claim — treat as constraints, not preferences. Full detail in `.claude/rules/privacy.md`, `accessibility.md`, `ai-agents.md`.

1. **No live tracking** — store the resource node a person heads to, never their GPS trail. No column for a person's real coordinates.
2. **Geofuzzing** — need beacons snap to a ~250m cell on capture; exact meetup only on mutual accept.
3. **k-anonymity** — never render a heatmap cell with < 5 signals (enforced in derivation).
4. **No PII to the model** — agents see aliases/need-types/words/fuzzed-cells; route all model inputs through `lib/redaction.ts`.
5. **Human-in-the-loop on anything touching a person** — Triage/Navigator recommend; a human confirms before routing/messaging. Autonomy (Resource/Foresight) only on public/aggregate data.
6. **No account barrier** on the crisis side — device-session token, anonymous Supabase session.
7. **Icon-first, multilingual (en/es), low-data, WCAG AA, trauma-informed copy** on the crisis side.
8. **Every recommendation is explainable** — plain-language rationale persisted; low confidence escalates to a human queue.

Have the `privacy-guardian` subagent review any change touching these before a milestone is done. See [[stack-decisions]] for the simulated-capacity honesty point.
