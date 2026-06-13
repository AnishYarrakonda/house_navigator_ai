# Rules

Enforceable guardrails for building Waypoint. These are **constraints, not suggestions** — several encode the product's core dignity claims, and violating them breaks the pitch.

Read the rule(s) relevant to what you're touching:

| File | Read it when you touch… |
|---|---|
| `privacy.md` | location, the `person`/`need` tables, model inputs, the heatmap, RLS, sessions |
| `accessibility.md` | any crisis-side UI, copy, i18n, color, tap targets |
| `map.md` | MapLibre, layers, zoom behaviors, animations, performance |
| `ai-agents.md` | any of the four runtime agents, the orchestrator, agent tool use |
| `data-sources.md` | seeding, DataSF/NWS ingestion, the Resource/Foresight agents |
| `code-style.md` | any code — naming, structure, conventions |

When a rule and a milestone plan disagree, the rule wins on **privacy/accessibility/HITL**; the plan wins on scope/ordering. If genuinely stuck, surface the conflict rather than guessing.
