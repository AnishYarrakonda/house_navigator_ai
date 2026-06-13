# M2 — Live Sync (it's actually live)

> **Goal:** Volunteer side receives the beacon and accepts; Supabase Realtime wires both screens so they update **together**. Triage Agent comes online here.
> **Showable moment:** two screens side-by-side; a need on one lights up the other; confirming a bed drops the count live on **both**.
> **Rules:** `privacy.md` (RLS, redaction, consent), `ai-agents.md` (Triage = HITL), `map.md` (DB-driven state), `code-style.md`.
> **Best subagents:** `supabase-architect`, then `volunteer-coordinator-frontend` + `ai-agents-engineer`. End with `privacy-guardian`.

## Tasks

1. **Supabase project + schema.** Migrations for all §5 tables (`person`, `need`, `resource_node`, `journey`, `waypoint`, `volunteer`, `message`). Typed client in `lib/supabase.ts`; `seed.sql` from `data-sources.md`.
2. **RLS policies.** Per `privacy.md`: default deny; person sees own rows via session token; volunteer sees need `type` + `fuzzed_geocell` + distance (not identity) until accept; journey visible only if `consent_share_journey`; `resource_node` public-read.
3. **Anonymous sessions** for crisis side; normal auth for volunteers.
4. **Move map state onto Realtime.** Pins/capacity/beacons subscribe to Supabase Realtime — migrate M0/M1 local state.
5. **Volunteer side.** Inbound need cards (distance + need type, no identity); accept → opens a private `message` thread; sees the person's journey-so-far **only if consented**.
6. **Confirm a resource.** Volunteer confirms a bed → **decrement `capacity_open` for everyone** (Realtime propagates to all screens) + sends a short reassuring message.
7. **Triage Agent online.** On need open (Postgres trigger → fn), Triage reads the person's words + constraints, ranks nodes over live capacity/hours/eligibility/distance **with a rationale**, recommends to the co-pilot. Inputs via `lib/redaction.ts`. Low confidence → human queue.
8. **`privacy-guardian` review.** RLS, redaction, geofuzz, consent default-off, beacon expiry.

## Done when

- Two browsers: a need opened on the crisis side appears as a beacon + card on the volunteer side; accept opens a thread; confirming a bed drops the count live on both.
- Triage returns a ranked recommendation **with a written rationale**; a human confirms before routing.
- RLS verified: a volunteer cannot read identity or precise location; an unconsented journey is hidden.

## Notes

- This is the "it's actually live" demo beat — prioritize the Realtime round-trip working flawlessly over breadth.
