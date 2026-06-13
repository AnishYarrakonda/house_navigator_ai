// Basemap for Waypoint. We use CARTO's free **vector** "Dark Matter" GL style —
// no token, no billing (see .claude/rules/map.md). Vector tiles give crisp
// streets + labels at every zoom (the old raster `dark_all` tiles washed out and
// pixelated on retina, which read as "unprofessional"). Our glowing overlays
// (pins / routes / beacons / heat) are added on top in engine.ts `initLayers()`.
//
// The style ships its own glyphs + sprite, so MapLibre symbol/label layers work
// out of the box. MapLibre accepts either a StyleSpecification object or a style
// URL string here; we pass the hosted vector style URL.
//
// Export names are kept (`warmDarkStyle`, `WARM_BG`) so importers don't churn.

/** CARTO free vector dark style (no API key required). */
export const warmDarkStyle =
  "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

/** Deep near-black that matches the basemap; used as the container background so
 * the hero shot + overlays still read if tiles are slow on weak signal. */
export const WARM_BG = "#0b0c0e";
