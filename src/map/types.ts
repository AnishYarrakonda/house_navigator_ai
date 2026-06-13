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

/** Minimal GeoJSON LineString feature for a journey route. */
export interface RouteGeoJSON {
  type: "Feature";
  geometry: {
    type: "LineString";
    coordinates: [number, number][];
  };
  properties?: Record<string, unknown>;
}

export interface MapController {
  flyTo(opts: FlyToOptions): void;
  setZoomLayer(layer: ZoomLayer): void;

  highlightNodes(ids: string[]): void;
  clearHighlights(): void;

  /** Pulse a beacon from a FUZZED cell — never a precise point (privacy.md). */
  pulseBeacon(geocell: string): void;

  drawRoute(journeyId: string, geojson: RouteGeoJSON): void;
  removeRoute(journeyId: string): void;

  showHeatmap(cells: HeatCell[]): void;
  hideHeatmap(): void;

  /** Move the region-view time scrubber to hour-of-day (0–23). */
  setTimeScrub(hour: number): void;
}
