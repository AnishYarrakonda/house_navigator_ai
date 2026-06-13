# M4 — The Heatmap (intelligence / coordinator view)

> **Goal:** Region-zoom **k-anonymized** heat + **time scrubber** + a **"pre-position resource"** drop. Foresight Agent comes online.
> **Showable moment:** zoom out → tonight's need heatmap; Foresight has flagged a district; drop a pre-position pin → the bloom cools.
> **Rules:** `privacy.md` (k-anonymity is mandatory here), `ai-agents.md` (Foresight = autonomous, aggregate-only), `data-sources.md` (311/waitlist/NWS), `map.md`.
> **Best subagents:** `ai-agents-engineer`, `map-engineer`, `supabase-architect`.

## Tasks

1. **Derived heatmap.** Aggregate `need.fuzzed_geocell` + journey density into cells. **Never render a cell with < N (=5) signals** — enforce in the derivation/query, not the UI. MapLibre built-in `heatmap` layer.
2. **Time scrubber.** Scrub through a day to watch need migrate (food demand AM, shelter at dusk; a cold snap reddening the map).
3. **Coordinator capacity management.** Same map zoomed out: view/manage `resource_node` capacity.
4. **Pre-position drop.** Coordinator drops a "resource pre-position" pin on a rising bloom → the area cools as it's served.
5. **Foresight Agent online.** Scheduled (cron / Edge Fn): watches 311 (`vw6y-z8j6`), HSH waitlist (`w4sk-nq57`), NWS forecast (`api.weather.gov`), and the anonymized heatmap. When signals align → posts a **pre-positioning alert** to coordinators. Runs unattended **because aggregate/public only** — never an identifiable person.

## Done when

- Region zoom shows a k-anonymized heatmap; verify no cell with < 5 signals renders.
- Time scrubber animates need migration.
- Foresight posts a real alert from aligned signals; coordinator can pre-position and watch the bloom cool.

## Notes

- This is where "no one on this map is locatable" gets demonstrated — the k-anon enforcement must be real and checkable, not cosmetic.
- Keep real demand data (311/waitlist) real; only `capacity_open` is simulated (`data-sources.md`).
