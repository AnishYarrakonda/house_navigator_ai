---
name: project-overview
description: What Waypoint is — the two-sided housing-dignity app and its winning frame
metadata:
  type: project
---

**Waypoint** is a two-sided, map-first web app for a **Housing Dignity** hackathon track. A person in crisis finds safety *tonight* and watches their *path home* grow as a glowing route on a living map; a volunteer co-pilot walks that path with them; coordinators see anonymized need as a heatmap. Four Claude-powered runtime agents (Resource, Triage, Navigator, Foresight) run live ops with a human in the loop on anything touching a person.

The unit of the product is a **path home**, not a request or a region — that framing is the dignity differentiator. Full spec, plans, and rules live under `.claude/` (start at [[stack-decisions]] and `.claude/plans/BIG_PICTURE.md`). Demo centers on San Francisco with real DataSF sources.

Built demo-first in milestones M0–M5 (see `.claude/plans/`). As of 2026-06-13 **all milestones are shipped** and the app runs end-to-end on seeded data (typecheck/lint/tests green, deploys to Vercel): MapLibre map, the three role panels, the `mock`|`live` data layer (`VITE_DATA_MODE`), and the four runtime agents as `/api/*` endpoints. **Current focus:** a presentation-only front-end revamp to the [[design-system]] (cobalt × deep-teal, replacing warm-amber) — flows, data hooks, matching/triage, agents, and the `MapController` interface are frozen. See [[dignity-invariants]] for the hard constraints and [[stack-decisions]] for the toolchain.
