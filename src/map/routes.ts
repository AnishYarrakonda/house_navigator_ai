// Build glowing route geometry for the city layer from journeys + their
// waypoints. We READ the shared data layer (db.getWaypoints) and the nodes hook
// — we never edit src/lib/data. Privacy: routes are drawn through resource-node
// locations + a deterministic, non-identifying origin per person; there is no
// real person coordinate anywhere (privacy.md invariant #1).

import { db } from "../lib/data";
import { SF_CENTER } from "../config";
import { fetchRouteMulti, type LatLng } from "../lib/routing";
import type { Journey, ResourceNode, Waypoint } from "../types";

export type RouteSegment = "done" | "todo";

export interface RouteFeature {
  type: "Feature";
  geometry: { type: "LineString"; coordinates: [number, number][] };
  properties: { journeyId: string; segment: RouteSegment };
}

type Coord = [number, number];

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
}

/** Deterministic pseudo-random in [0,1) from a numeric seed. */
function rand01(seed: number): number {
  const x = Math.sin(seed) * 43758.5453;
  return x - Math.floor(x);
}

/** A stable, non-identifying origin point spread across SF for a person. */
function originFor(personId: string): Coord {
  const h = hashStr(personId);
  const dLng = (rand01(h) - 0.5) * 0.05; // ~±2.2km
  const dLat = (rand01(h + 99) - 0.5) * 0.04; // ~±2.2km
  return [SF_CENTER.lng + dLng, SF_CENTER.lat + dLat];
}

/** A small deterministic drift for a node-less future waypoint. */
function driftFrom(prev: Coord, seedKey: string): Coord {
  const h = hashStr(seedKey);
  const dLng = (rand01(h) - 0.5) * 0.014;
  const dLat = (rand01(h + 7) - 0.5) * 0.014;
  return [prev[0] + dLng, prev[1] + dLat];
}

/** Map ordered waypoints to coordinates, synthesizing node-less stops. */
function waypointCoords(
  waypoints: Waypoint[],
  nodeById: Map<string, ResourceNode>,
): { coords: Coord[]; lastDoneIndex: number } {
  const coords: Coord[] = [];
  let prev: Coord | null = null;
  let lastDoneIndex = -1;

  waypoints.forEach((wp, i) => {
    const node = wp.node_id ? nodeById.get(wp.node_id) : undefined;
    let pt: Coord;
    if (node) {
      pt = [node.lng, node.lat];
    } else if (prev === null) {
      // First stop with no node = where the person reached out (synthetic).
      pt = originFor(wp.journey_id + ":" + wp.id);
    } else {
      pt = driftFrom(prev, wp.id);
    }
    coords.push(pt);
    prev = pt;
    if (wp.status === "complete" || wp.status === "current") lastDoneIndex = i;
  });

  return { coords, lastDoneIndex };
}

/**
 * Snap a run of stop coordinates to real walking roads via the ORS proxy.
 * Falls back (inside fetchRouteMulti) to a curved line if ORS is unavailable, so
 * this never throws and never blanks the map.
 */
async function snapRun(coords: Coord[]): Promise<Coord[]> {
  if (coords.length < 2) return coords;
  const points: LatLng[] = coords.map(([lng, lat]) => ({ lat, lng }));
  const route = await fetchRouteMulti(points);
  const snapped = route.geojson.geometry.coordinates;
  return snapped.length >= 2 ? snapped : coords;
}

/**
 * Build done + todo line features for one journey. `done` = the bright solid
 * glow up to the current waypoint; `todo` = the dim dotted path still ahead.
 * Both runs are road-snapped so the glow traces streets, not a straight hop.
 */
export async function journeyToFeatures(
  journey: Journey,
  waypoints: Waypoint[],
  nodeById: Map<string, ResourceNode>,
): Promise<RouteFeature[]> {
  const ordered = [...waypoints].sort((a, b) => a.order - b.order);
  const { coords, lastDoneIndex } = waypointCoords(ordered, nodeById);
  if (coords.length < 2) return [];

  const features: RouteFeature[] = [];

  if (lastDoneIndex >= 1) {
    features.push({
      type: "Feature",
      geometry: {
        type: "LineString",
        coordinates: await snapRun(coords.slice(0, lastDoneIndex + 1)),
      },
      properties: { journeyId: journey.id, segment: "done" },
    });
  }

  // Upcoming path starts at the last reached point so it connects visually.
  const todoStart = Math.max(0, lastDoneIndex);
  const todoCoords = coords.slice(todoStart);
  if (todoCoords.length >= 2) {
    features.push({
      type: "Feature",
      geometry: { type: "LineString", coordinates: await snapRun(todoCoords) },
      properties: { journeyId: journey.id, segment: "todo" },
    });
  }

  return features;
}

/**
 * Build route features for every active journey (the hero shot + many-routes
 * reveal). Reads waypoints from the shared data layer.
 */
export async function buildJourneyRoutes(
  journeys: Journey[],
  nodes: ResourceNode[],
): Promise<RouteFeature[]> {
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const active = journeys.filter((j) => j.status !== "complete");
  const perJourney = await Promise.all(
    active.map(async (j) => {
      const waypoints = await db.getWaypoints(j.id);
      return journeyToFeatures(j, waypoints, nodeById);
    }),
  );
  return perJourney.flat();
}
