// Client-side routing helper. Fetches a road-snapped route between two points
// from our serverless ORS proxy (`/api/route`), returning MapLibre-ready GeoJSON
// for MapController.drawRoute(). Falls back to a smooth curved line if the proxy
// is unavailable (plain `npm run dev` with no functions, or ORS down) so the
// route still reads on the map.
//
// Privacy: callers pass the FUZZED cell center as the origin, never a precise
// person point (privacy.md invariant #1/#2).

import type { RouteGeoJSON } from "../map/types";

export interface LatLng {
  lat: number;
  lng: number;
}

/** A road-snapped route + its travel estimate. `geojson` is drawable as-is. */
export interface RouteResult {
  geojson: RouteGeoJSON;
  distanceMeters: number;
  durationSeconds: number;
}

const toRouteGeoJSON = (coords: [number, number][]): RouteGeoJSON => ({
  type: "Feature",
  geometry: { type: "LineString", coordinates: coords },
  properties: {},
});

/** Haversine distance in meters. */
export function haversineMeters(a: LatLng, b: LatLng): number {
  const R = 6371000;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(la1) * Math.cos(la2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A gently curved fallback line (quadratic bezier) between two points. */
function curvedFallback(from: LatLng, to: LatLng): RouteResult {
  const steps = 24;
  const mx = (from.lng + to.lng) / 2;
  const my = (from.lat + to.lat) / 2;
  // Perpendicular offset so the line bows instead of going dead-straight.
  const dx = to.lng - from.lng;
  const dy = to.lat - from.lat;
  const cx = mx - dy * 0.18;
  const cy = my + dx * 0.18;
  const coords: [number, number][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const lng =
      (1 - t) ** 2 * from.lng + 2 * (1 - t) * t * cx + t ** 2 * to.lng;
    const lat =
      (1 - t) ** 2 * from.lat + 2 * (1 - t) * t * cy + t ** 2 * to.lat;
    coords.push([lng, lat]);
  }
  const distanceMeters = haversineMeters(from, to);
  return {
    geojson: toRouteGeoJSON(coords),
    distanceMeters,
    // ~1.35 m/s walking pace.
    durationSeconds: distanceMeters / 1.35,
  };
}

/**
 * Road-snapped walking route from `from` → `to`. Tries the `/api/route` ORS
 * proxy first; on any failure returns a curved fallback so the UI never breaks.
 */
export async function fetchRoute(
  from: LatLng,
  to: LatLng,
): Promise<RouteResult> {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ from, to }),
    });
    if (!res.ok) throw new Error(`route ${res.status}`);
    const data = (await res.json()) as {
      coordinates: [number, number][];
      distanceMeters: number;
      durationSeconds: number;
    };
    if (!data.coordinates?.length) throw new Error("no geometry");
    return {
      geojson: toRouteGeoJSON(data.coordinates),
      distanceMeters: data.distanceMeters,
      durationSeconds: data.durationSeconds,
    };
  } catch {
    return curvedFallback(from, to);
  }
}
