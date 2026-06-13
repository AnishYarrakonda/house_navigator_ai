# Rule: The Map (the hero)

The map is the **#1 priority** and the home screen on **both** sides — not a tab. It loads first. If everything else breaks, the map alone must wow on load (that's M0).

## One map, three zoom-keyed behaviors

| Zoom | Layer | What's shown |
|---|---|---|
| **Street** (*tonight*) | resource pins | shelter/food/hygiene/clinic/charging-wifi nodes with **live capacity** (`3/40 beds`), color green→amber→red as they fill; beacon **pulse ripple** from a *fuzzed* area when a need opens |
| **City** (*journey*) | glowing routes | each active person = a route threading reached-out → waypoints; **completed segments solid & bright, upcoming dotted & dim** |
| **Region** (*intelligence*) | heatmap | k-anonymized **cobalt** blooms where need concentrates; **time scrubber** to watch need migrate through a day |

The signature moment: one luminous route animating across the city on load, then — pull back — dozens of them. That zoom-out reveal is the screenshot.

## Technical conventions

- **MapLibre GL JS** (open source, **no token/billing**) over CARTO `dark_all` tiles, themed to the **Navigation Map** design system: a cobalt × deep-teal **dark** basemap (`--wp-bg` `#08090a`, neutral/cool — *not* the old warm-amber hue-rotate). The design source of truth is `Navigation Map/` (tokens + screen mockups); retheme the visual layer to match, don't replace the real map with the mockups' faux-map.
- **Theme palette:** primary action / beacons cobalt `#2f6df6` (core `#5ab8ff`); live indicators & routes deep teal `#0e9594`/`#2cb8b4` (route core `#5ab8ff`, upcoming `#2f6df6`); capacity open `#4cc38a` / filling `#d8b65c` / full `#e36a7d`.
- **Resource pins** render as a fixed-size **circular icon badge** (Material Symbols glyph per type) **plus a separate capacity pill** — `display:inline-flex; width:max-content; white-space:nowrap`. Do **not** let the marker stretch full-width (that's the bug the revamp fixes).
- Routes → animated GeoJSON **`line`** layers. Beacon pulses → animated **`circle`** layers. Region heat → MapLibre's built-in **`heatmap`** layer. *(Stretch: deck.gl on top for route glow — keep it additive, don't make the MVP depend on it.)*
- **Center on San Francisco.** Seed nodes + 3–4 scripted in-flight journeys so the map is alive *and believable* the instant it loads.
- **Map state is DB-driven.** Pins/capacity/beacons/routes/heat update from **Supabase Realtime** subscriptions (live mode), not local-only state — the live update is the demo's wow (M2). Mock mode drives the same UI from the in-memory data layer.
- The `MapController` interface (`src/map/types.ts`) is the frozen contract between the panels and the map engine — retheme the visual layer (`style.ts`, `visuals.ts`, `engine.ts`, `map.css`) without changing it.
- Capacity color is derived from `capacity_open / capacity_total`; pair color with a label/shape (see `accessibility.md` — don't rely on color alone).
- Beacon source geometry must be the **fuzzed** cell, never a precise point (see `privacy.md`).
- Lazy-load tiles; keep the crisis-path bundle light (see `accessibility.md`).

## Performance

- Use GeoJSON sources with feature-state updates for capacity/route changes rather than re-creating layers.
- Throttle animation frames; keep pulse/route animations cheap enough for old Android.
