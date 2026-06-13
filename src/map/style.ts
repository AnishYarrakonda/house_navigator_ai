// Cool-dark basemap style for Waypoint (Navigation Map design system). MapLibre
// GL JS, NO token / billing (see .claude/rules/map.md). Basemap is CARTO's free
// raster dark tiles, kept neutral/cool to sit under cobalt routes + heat. A deep
// near-black background bleeds through the shadows, so if the network/tiles fail
// the background + our glowing overlays still read — the hero shot degrades
// gracefully on weak signal (accessibility.md).
//
// Export names are kept (`warmDarkStyle`, `WARM_BG`) so importers don't churn.

import type { StyleSpecification } from "maplibre-gl";

// Charcoal base — lifted off pure near-black so the street network, labels, and
// landmarks on the CARTO tiles stay legible (the old #08090a crushed them into
// the background). Still a modern dark theme; just readable.
export const WARM_BG = "#15171b";

const CARTO_SUBDOMAINS = ["a", "b", "c", "d"];
const cartoTiles = CARTO_SUBDOMAINS.map(
  (s) => `https://${s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png`,
);

export const warmDarkStyle: StyleSpecification = {
  version: 8,
  // No glyphs/sprite needed: all labels are HTML markers and all overlays are
  // geometry-only GL layers, so the style stays fully self-contained.
  sources: {
    "carto-dark": {
      type: "raster",
      tiles: cartoTiles,
      tileSize: 256,
      minzoom: 0,
      maxzoom: 20,
      attribution:
        '© <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a> contributors, © <a href="https://carto.com/attributions" target="_blank" rel="noopener">CARTO</a>',
    },
  },
  layers: [
    {
      id: "warm-bg",
      type: "background",
      paint: { "background-color": WARM_BG },
    },
    {
      id: "carto-dark",
      type: "raster",
      source: "carto-dark",
      paint: {
        // Keep the basemap readable: full opacity, blacks lifted toward charcoal
        // so streets/labels/landmarks show, only lightly desaturated so cobalt/
        // teal overlays still read in front. (Previously over-dimmed → invisible
        // streets.)
        "raster-opacity": 1,
        "raster-saturation": -0.1,
        "raster-brightness-max": 1,
        "raster-brightness-min": 0.08,
        "raster-contrast": 0,
      },
    },
  ],
};
