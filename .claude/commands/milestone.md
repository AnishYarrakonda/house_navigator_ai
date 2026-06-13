---
description: Orchestrate a Waypoint milestone (M0–M5) end-to-end using the right subagents and rules
argument-hint: M0 | M1 | M2 | M3 | M4 | M5
---

Orchestrate milestone **$1** of Waypoint.

Do this in order:

1. Read `.claude/plans/BIG_PICTURE.md`, then `.claude/plans/$1-*.md` (the target milestone), then every rule that milestone references in `.claude/rules/`.
2. If the milestone needs scaffolding that doesn't exist yet (Vite app, Supabase project, migrations), do that as the first task.
3. Work the milestone's task list. For focused work, dispatch the matching subagent named in the plan (e.g. `map-engineer`, `supabase-architect`, `crisis-frontend`, `volunteer-coordinator-frontend`, `ai-agents-engineer`). Run independent tasks in parallel where safe.
4. If the work touched location, person data, model inputs, RLS, consent, or the heatmap, finish by dispatching the `privacy-guardian` subagent to review against the dignity invariants. Address any FAIL before proceeding.
5. Verify the milestone's "Done when" criteria — run `npm run lint && npm run typecheck && npm test` and confirm the showable moment actually works. Report results with evidence, not assertions.

Do not silently expand scope beyond milestone $1. If a blocker needs a user decision, surface it.
