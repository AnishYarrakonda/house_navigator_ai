// Display helpers for the co-pilot side. Everything here operates on the
// already-FUZZED geocell (privacy invariant #2) — we resolve a cell to its
// ~250m center only to (a) estimate a rough distance and (b) name a *public*
// nearby landmark. We never see or render a person's precise point or identity.

import { SF_CENTER } from "../../config";
import { geocellCenter } from "../../lib/geocell";
import type { ResourceNode } from "../../types";

/**
 * The co-pilot's own reference location for rough distance estimates. There is
 * no volunteer GPS in scope for the demo, so we anchor on the SF center. This
 * is only ever used against a fuzzed cell center, never a person's real point.
 */
export const VOLUNTEER_REF = SF_CENTER;

const EARTH_RADIUS_M = 6_371_000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in meters between two {lat,lng} points. */
export function metersBetween(
  a: { lat: number; lng: number },
  b: { lat: number; lng: number },
): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.sqrt(h));
}

/** {lat,lng} of a fuzzed cell's center (geocellCenter returns [lng,lat]). */
export function cellCenter(geocell: string): { lat: number; lng: number } {
  const [lng, lat] = geocellCenter(geocell);
  return { lat, lng };
}

/** Rough distance from the co-pilot's reference to a fuzzed cell, in miles. */
export function milesFromVolunteer(geocell: string): number {
  const meters = metersBetween(VOLUNTEER_REF, cellCenter(geocell));
  return meters / 1609.344;
}

/** Human "0.8 mi" / "350 ft" — coarse on purpose; this is a fuzzed area. */
export function formatMiles(miles: number): string {
  if (miles < 0.1) return `${Math.round((miles * 5280) / 50) * 50} ft`;
  return `${miles.toFixed(1)} mi`;
}

/**
 * Name the nearest PUBLIC resource node to a fuzzed cell, so a co-pilot can
 * orient ("a few blocks from GLIDE") without ever seeing the person's point.
 * Returns undefined if there are no nodes to reference.
 */
export function nearestLandmark(
  geocell: string,
  nodes: ResourceNode[],
): string | undefined {
  const center = cellCenter(geocell);
  let best: { name: string; d: number } | undefined;
  for (const node of nodes) {
    const d = metersBetween(center, { lat: node.lat, lng: node.lng });
    if (!best || d < best.d) best = { name: node.name, d };
  }
  return best?.name;
}

/** Hours until a beacon expires — for a gentle, non-shaming freshness hint. */
export function hoursUntil(iso: string): number {
  return (new Date(iso).getTime() - Date.now()) / 3_600_000;
}
