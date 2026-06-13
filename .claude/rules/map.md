# Rule: The Map (the hero)

The map is the **#1 priority** and the home screen on **both** sides — not a tab. It loads first. If everything else breaks, the map alone must wow on load (that's M0).

## One map, three zoom-keyed behaviors

| Zoom | Layer | What's shown |
|---|---|---|
| **Street** (*tonight*) | resource pins | shelter/food/hygiene/clinic/charging-wifi nodes with **live capacity** (`3/40 beds`), color green→amber→red as they fill; beacon **pulse ripple** from a *fuzzed* area when a need opens |
| **City** (*journey*) | glowing routes | each active person = a route threading reached-out → waypoints; **completed segments solid & bright, upcoming dotted & dim** |
| **Region** (*intelligence*) | heatmap | k-anonymized warm blooms where need concentrates; **time scrubber** to watch need migrate through a day |

The signature moment: one luminous route animating across the city on load, then — pull back — dozens of them. That zoom-out reveal is the screenshot.

## Technical conventions

- **MapLibre GL JS** (open source, **no token/billing**). Custom **warm-dark** basemap style.
- Routes → animated GeoJSON **`line`** layers. Beacon pulses → animated **`circle`** layers. Region heat → MapLibre's built-in **`heatmap`** layer. *(Stretch: deck.gl on top for route glow — keep it additive, don't make the MVP depend on it.)*
- **Center on San Francisco.** Seed nodes + 3–4 scripted in-flight journeys so the map is alive *and believable* the instant it loads.
- **Map state is DB-driven.** Pins/capacity/beacons/routes/heat update from **Supabase Realtime** subscriptions, not local-only state — the live update is the demo's wow (M2). Local state is acceptable only in M0/M1 before Realtime is wired, and should be migrated.
- Capacity color is derived from `capacity_open / capacity_total`; pair color with a label/shape (see `accessibility.md` — don't rely on color alone).
- Beacon source geometry must be the **fuzzed** cell, never a precise point (see `privacy.md`).
- Lazy-load tiles; keep the crisis-path bundle light (see `accessibility.md`).

## Performance

- Use GeoJSON sources with feature-state updates for capacity/route changes rather than re-creating layers.
- Throttle animation frames; keep pulse/route animations cheap enough for old Android.
