// Warm-dark basemap style for Waypoint. MapLibre GL JS, NO token / billing
// (see .claude/rules/map.md). Basemap is CARTO's free raster dark tiles, tinted
// warm via raster paint + a warm background that bleeds through the shadows. If
// the network/tiles fail, the warm background + our glowing overlays still read,
// so the hero shot degrades gracefully on weak signal (accessibility.md).

import type { StyleSpecification } from "maplibre-gl";

// Warm near-black — the same anchor as the Tailwind `waypoint.bg` token.
export const WARM_BG = "#1a1410";

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
        // Let a little warm background bleed through the dark tiles, and nudge
        // the cool grey basemap toward amber.
        "raster-opacity": 0.9,
        "raster-hue-rotate": 18,
        "raster-saturation": -0.1,
        "raster-brightness-min": 0.02,
        "raster-contrast": 0.05,
      },
    },
  ],
};
