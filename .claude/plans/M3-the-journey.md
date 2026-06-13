# M3 — The Journey (the emotional centerpiece)

> **Goal:** Once tonight's need is met, the thread becomes a **journey**; the route **grows** as waypoints complete; the city-zoom **many-routes reveal**. Navigator Agent comes online.
> **Showable moment:** mark "safe tonight" done → route extends a dotted line to the next waypoint; zoom out → dozens of glowing routes.
> **Rules:** `ai-agents.md` (Navigator = HITL), `map.md` (city-zoom routes), `accessibility.md` (Navigator-drafted cards), `privacy.md`.
> **Best subagents:** `ai-agents-engineer`, `map-engineer`.

## Tasks

1. **Need → journey transition.** When tonight's need is met, create a `journey`; first waypoint ("safe tonight") locks in as **complete**.
2. **Waypoint model + UI.** Person + co-pilot add next waypoints (intake → ID/benefits → transitional → job program → permanent), each tied to a `node` and a `date`, with status upcoming/active/done.
3. **Growing route.** Each completed waypoint **extends and brightens** the glowing route (completed solid+bright, upcoming dotted+dim). Drives off `waypoint` rows via Realtime.
4. **Navigator Agent online.** On need-close (Triage → Navigator handoff via the supervisor), it proposes next waypoints, drafts trauma-informed "what to expect" cards + reminder nudges, surfaces likely eligibility (GA/CalFresh/Coordinated Entry). Recommends; person/co-pilot confirm. Drafted copy goes through i18n.
5. **City-zoom many-routes reveal.** At city zoom, render every active journey's route. The pull-back reveal is the screenshot — make it smooth.

## Done when

- Completing a waypoint visibly grows the route on the map (live).
- Navigator proposes a real next waypoint with a rationale + a drafted arrival card; a human confirms.
- Zooming out shows multiple glowing routes cleanly.

## Notes

- The Triage → Navigator handoff is the "two agents" demo beat — make the supervisor routing visible/loggable.
- Keep route rendering performant with many journeys (feature-state updates, not layer rebuilds — see `map.md`).
