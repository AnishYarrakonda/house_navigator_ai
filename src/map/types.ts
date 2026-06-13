// The MapController contract. Crisis / volunteer / coordinator lanes drive the
// map THROUGH this interface — they never edit map code. Lane 1 implements it
// for real and replaces the no-op stub in MapContext. FROZEN for the lanes.

import type { HeatCell } from "../types";

/** Zoom-keyed behavior layers (see .claude/rules/map.md). */
export type ZoomLayer = "street" | "city" | "region";

export interface FlyToOptions {
  lng: number;
  lat: number;
  zoom?: number;
  /** Animation duration in ms. */
  duration?: number;
}

/** A precise tapped coordinate. The caller MUST fuzz it before storing it
 * (privacy.md invariant #2) — the map never stores or transmits it. */
export interface LngLat {
  lng: number;
  lat: number;
}

/** Minimal GeoJSON LineString feature for a journey route. */
export interface RouteGeoJSON {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties?: Record<string, unknown>;
}

/** Per-route styling for the multi-option route layer (crisis "pick a path"). */
export interface RouteStyleOptions {
  /** Hex line color, e.g. "#5ab8ff". */
  color?: string;
  /** Render dimmed/translucent — an unselected option. */
  dim?: boolean;
  /** Render emphasized (brighter, thicker, on top) — the selected option. */
  selected?: boolean;
}

export interface MapController {
  flyTo(opts: FlyToOptions): void;
  setZoomLayer(layer: ZoomLayer): void;

  highlightNodes(ids: string[]): void;
  clearHighlights(): void;

  /** Pulse a beacon from a FUZZED cell — never a precise point (privacy.md). */
  pulseBeacon(geocell: string): void;

  /** Let the person tap their own location on the map (manual fallback when
   * device geolocation isn't available). The callback fires ONCE with the
   * tapped point; the caller fuzzes it before storing (privacy.md). */
  pickLocation(onPick: (point: LngLat) => void): void;
  /** Cancel an in-progress pickLocation without choosing a point. */
  cancelPick(): void;

  drawRoute(id: string, geojson: RouteGeoJSON, options?: RouteStyleOptions): void;
  removeRoute(id: string): void;
  /** Remove every route currently drawn (all ids). */
  clearRoutes(): void;
  /** Emphasize one route id (bright/thick, raised) and dim all others. Pass
   * null to render all equally. */
  setSelectedRoute(id: string | null): void;

  showHeatmap(cells: HeatCell[]): void;
  hideHeatmap(): void;

  /** Move the region-view time scrubber to hour-of-day (0–23). */
  setTimeScrub(hour: number): void;
}
