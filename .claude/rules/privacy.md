# Rule: Privacy & Consent (the dignity core)

These are hard constraints. A reviewer (the `privacy-guardian` subagent) must sign off on any change touching location, person data, model inputs, or the heatmap.

## Invariants

1. **No live tracking.** Store the *resource node a person is heading to*, never their GPS trail. A person's position on the map is the resource, not their body. There is **no column for a person's real coordinates** — don't add one.

2. **Geofuzzing.** Need beacons snap to a **~250m grid cell** (`need.fuzzed_geocell`), never a precise point. Fuzz on capture, before the value is ever stored or transmitted — never store the precise point and fuzz on display. Volunteers see "a few blocks from X"; exact meetup is revealed **only on mutual accept**.

3. **k-anonymity on the heatmap.** Any aggregate cell with **fewer than N (=5)** active signals is **not rendered**. Enforce in the query/derivation, not in the UI layer. The heatmap is *derived* from `need.fuzzed_geocell` + journey density — never from raw points.

4. **Person owns the journey.** `consent_share_journey` defaults to **false**. The co-pilot sees only what's shared. The person can revoke anytime, and revocation takes effect immediately on the volunteer's view.

5. **Beacons expire.** Open needs auto-expire (default **6h** via `need.expires_at`) so nothing lingers as a stale signal of where someone was. Expiry must be enforced server-side (not just hidden in the UI).

6. **No account barrier on the crisis side.** Device-session token (`person.device_session_token`), not email/password. Supabase **anonymous sessions** for the crisis side; normal auth for volunteers/orgs.

## No PII reaches the model

The four runtime agents (`ai-agents.md`) operate on a **redacted view**:
- They see: `display_alias`, `need.type`, the person's free-text need *words*, `fuzzed_geocell`, resource data, aggregate/anonymized signals.
- They **never** see: legal names, precise coordinates, device tokens, contact info.
- Enforce with **RLS + a redaction layer** between the DB and any Claude API call. The redaction layer is the chokepoint — route all model inputs through it; never hand-assemble a prompt from raw rows.

> The person's free-text words *are* sent to Triage (that's the showcase reasoning task), so the crisis-side copy should gently steer away from volunteering legal names. Don't block it, but don't store it in a way the model or volunteers can mine.

## RLS posture

- Default deny. A person can read/write only their own `person`/`need`/`journey`/`message` rows (via session token).
- A volunteer sees a need's `type` + `fuzzed_geocell` + distance — **not** identity — until accept; sees a journey only if `consent_share_journey` is true.
- Coordinators read only the **derived, k-anonymized** heatmap aggregates — never base rows.
- `resource_node` is public-readable.

## Demo honesty

`capacity_open` (and any per-bed availability) is **seeded/simulated and must be labeled as such** — SF publishes no public real-time per-bed feed. See `data-sources.md`. Don't fake a "live bed API."
