# Prompt 03 — Lane 3: Volunteer Co-pilot + Coordinator

You build the **volunteer/co-pilot** side and the **coordinator** view. The coordinator view is the same map zoomed out, not a separate app. Run AFTER the foundation is merged.

**First:**
1. `git pull origin main`, then: `git worktree add ../waypoint-vol -b lane/volunteer`.
2. Read `.claude/rules/privacy.md` (volunteers see need type + fuzzed cell + distance, NOT identity, until accept; consent gates the journey), `.claude/rules/ai-agents.md` (you render agent **recommendations + rationale**; a human confirms), `.claude/rules/map.md`, `.claude/rules/accessibility.md`, `.claude/plans/M2-live-sync.md`, `M3-the-journey.md`, `M4-heatmap.md`.

## You OWN (edit only these)

- `src/features/volunteer/**` — replace the `VolunteerPanel.tsx` stub.
- `src/features/coordinator/**` — replace the `CoordinatorPanel.tsx` stub.

## You CONSUME (import, never edit)

- `src/lib/data/hooks.ts` + `db`: `useNeeds`, `claimNeed`, `confirmResource`, `useJourneys`, `addWaypoint`, `completeWaypoint`, `useMessages`, `sendMessage`, `getHeatmapCells`/`useForesightAlerts`. Build against `mock`.
- `useMapController()` — `highlightNodes`, `drawRoute`, `showHeatmap`, `setTimeScrub`, `flyTo`. **Never edit map code.**
- `src/components/kit/**` (from Lane 2) for buttons/cards — import, don't edit.

## Build — Volunteer (role === 'volunteer')

1. **Inbound need cards** from `useNeeds()` (open status): show **need type + distance + "a few blocks from X"** — **never identity or precise location**.
2. **Accept** → `db.claimNeed(...)`; open a private message thread (`useMessages`/`sendMessage`). Show the person's journey-so-far **only if `consent_share_journey`**.
3. **Triage recommendation** — if a need carries an agent recommendation (from Lane 4's `/api/triage`, surfaced via the data layer), render the ranked options **with the written rationale**, and a Confirm button. The volunteer confirming is the **human-in-the-loop** step.
4. **Confirm resource** → `db.confirmResource(needId, nodeId)` (decrements `capacity_open` — in `live` mode this propagates to all screens via Realtime) + send a short reassuring message.
5. **Mark next waypoint** — `completeWaypoint`/`addWaypoint`; this grows the route (Lane 1 redraws from journey data).

## Build — Coordinator (role === 'coordinator')

6. **Zoomed-out heatmap** — call `mapController.showHeatmap(await getHeatmapCells())` (cells are already k-anonymized; you just render). A **time scrubber** control wired to `setTimeScrub(hour)`.
7. **Capacity management** — simple list/edit of `resource_node` capacity.
8. **Foresight alerts + pre-position** — show `useForesightAlerts()` cards; a "pre-position resource" action drops a pin on the rising bloom.

## Done when

- `mock` mode, role=volunteer: a beacon/need appears as a card (no identity) → accept → thread opens → confirm a bed drops the count → mark a waypoint and the route grows.
- role=coordinator: heatmap renders, time scrubber animates need migration, a Foresight alert shows and you can pre-position.
- `npm run lint && npm run typecheck` pass. Open a PR.

## Hard rules

- **Never reveal identity or precise location pre-accept**; honor consent + immediate revocation.
- Always present agent output as a **recommendation a human confirms** — show the rationale, never auto-act on a person.
- The coordinator only ever sees **k-anonymized aggregates** — never base rows.
- Drive the map only through `useMapController()`.
