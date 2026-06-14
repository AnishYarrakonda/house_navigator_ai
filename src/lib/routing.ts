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

/** One turn-by-turn instruction from ORS (volunteer navigation). */
export interface RouteStep {
  instruction: string;
  distanceMeters: number;
  durationSeconds: number;
  /** ORS maneuver type enum — mapped to an icon (see features/volunteer/maneuver.ts). */
  type: number;
  /** Street name for this step (may be ""). */
  name: string;
  /** [start,end] indices into the route geometry coordinates. */
  wayPoints: [number, number];
}

/** A full route option: drawable geometry + estimate + turn-by-turn steps. */
export interface RouteOption extends RouteResult {
  steps: RouteStep[];
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

/** A gently bowed quadratic-bezier arc between two points (one segment). */
function bowedSegment(from: LatLng, to: LatLng, steps: number): [number, number][] {
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
    const lng = (1 - t) ** 2 * from.lng + 2 * (1 - t) * t * cx + t ** 2 * to.lng;
    const lat = (1 - t) ** 2 * from.lat + 2 * (1 - t) * t * cy + t ** 2 * to.lat;
    coords.push([lng, lat]);
  }
  return coords;
}

/**
 * A curved fallback line through all `points` (bowing each consecutive segment),
 * used when the ORS proxy is unavailable so a route still reads on the map.
 */
function curvedFallback(points: LatLng[]): RouteResult {
  const coords: [number, number][] = [];
  let distanceMeters = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const seg = bowedSegment(points[i], points[i + 1], 24);
    // Drop the duplicated join point between consecutive segments.
    coords.push(...(i === 0 ? seg : seg.slice(1)));
    distanceMeters += haversineMeters(points[i], points[i + 1]);
  }
  return {
    geojson: toRouteGeoJSON(coords),
    distanceMeters,
    // ~1.35 m/s walking pace.
    durationSeconds: distanceMeters / 1.35,
  };
}

// In-memory cache so re-selecting a pick and re-revealing seeded journeys don't
// re-hit ORS (free tier is 2000 req/day). Keyed by the rounded stop list; seed
// routes are deterministic so this stays warm for the whole session.
const routeCache = new Map<string, RouteResult>();
const cacheKey = (points: LatLng[]): string =>
  points.map((p) => `${p.lat.toFixed(5)},${p.lng.toFixed(5)}`).join(";");

/**
 * Road-snapped walking route through `points` (≥2 stops). Tries the `/api/route`
 * ORS proxy first; on any failure returns a curved fallback so the UI never
 * breaks. Results are cached by rounded coordinates.
 *
 * Privacy: callers pass FUZZED/synthetic origins, never a precise person point.
 */
export async function fetchRouteMulti(points: LatLng[]): Promise<RouteResult> {
  if (points.length < 2) {
    return { geojson: toRouteGeoJSON([]), distanceMeters: 0, durationSeconds: 0 };
  }
  const key = cacheKey(points);
  const cached = routeCache.get(key);
  if (cached) return cached;

  let result: RouteResult;
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        coordinates: points.map((p) => [p.lng, p.lat]),
      }),
    });
    if (!res.ok) throw new Error(`route ${res.status}`);
    const data = (await res.json()) as {
      coordinates: [number, number][];
      distanceMeters: number;
      durationSeconds: number;
    };
    if (!data.coordinates?.length) throw new Error("no geometry");
    result = {
      geojson: toRouteGeoJSON(data.coordinates),
      distanceMeters: data.distanceMeters,
      durationSeconds: data.durationSeconds,
    };
  } catch {
    result = curvedFallback(points);
  }
  routeCache.set(key, result);
  return result;
}

/**
 * Road-snapped walking route from `from` → `to`. Thin wrapper over
 * {@link fetchRouteMulti}.
 */
export function fetchRoute(from: LatLng, to: LatLng): Promise<RouteResult> {
  return fetchRouteMulti([from, to]);
}

export interface FetchRoutesOptions {
  /** Ask ORS for up to 3 distinct route options. Default true. */
  alternatives?: boolean;
  /** Language for the turn-by-turn instruction text (e.g. "en", "es"). */
  language?: string;
}

/**
 * Road-snapped walking route OPTIONS from `from` → `to`, each with turn-by-turn
 * steps — for the volunteer navigation flow. Tries `/api/route` (instructions +
 * alternatives); on any failure returns a single curved-fallback option (no
 * steps) so the UI never breaks.
 *
 * Privacy: the volunteer side passes its own/public points on purpose; this is
 * NOT used for a vulnerable person's precise location (privacy.md).
 */
export async function fetchRoutes(
  from: LatLng,
  to: LatLng,
  opts: FetchRoutesOptions = {},
): Promise<RouteOption[]> {
  try {
    const res = await fetch("/api/route", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        from,
        to,
        instructions: true,
        alternatives: opts.alternatives ?? true,
        language: opts.language,
      }),
    });
    if (!res.ok) throw new Error(`route ${res.status}`);
    const data = (await res.json()) as {
      routes?: Array<{
        coordinates: [number, number][];
        distanceMeters: number;
        durationSeconds: number;
        steps: RouteStep[];
      }>;
    };
    const routes = data.routes ?? [];
    if (routes.length === 0) throw new Error("no routes");
    return routes
      .filter((r) => r.coordinates?.length >= 2)
      .map((r) => ({
        geojson: toRouteGeoJSON(r.coordinates),
        distanceMeters: r.distanceMeters,
        durationSeconds: r.durationSeconds,
        steps: r.steps ?? [],
      }));
  } catch {
    const fallback = curvedFallback([from, to]);
    return [{ ...fallback, steps: [] }];
  }
}
