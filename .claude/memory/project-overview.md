---
name: project-overview
description: What Waypoint is — the two-sided housing-dignity app and its winning frame
metadata:
  type: project
---

**Waypoint** is a two-sided, map-first web app for a **Housing Dignity** hackathon track. A person in crisis finds safety *tonight* and watches their *path home* grow as a glowing route on a living map; a volunteer co-pilot walks that path with them; coordinators see anonymized need as a heatmap. Four Claude-powered runtime agents (Resource, Triage, Navigator, Foresight) run live ops with a human in the loop on anything touching a person.

The unit of the product is a **path home**, not a request or a region — that framing is the dignity differentiator. Full spec, plans, and rules live under `.claude/` (start at [[stack-decisions]] and `.claude/plans/BIG_PICTURE.md`). Demo centers on San Francisco with real DataSF sources.

Build is demo-first in milestones M0–M5 (see `.claude/plans/`). Repo started greenfield on 2026-06-13; the `.claude/` foundation was scaffolded first, app code follows per milestone. See [[dignity-invariants]] for the hard constraints.
