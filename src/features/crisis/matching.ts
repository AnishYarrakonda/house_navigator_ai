// Need → resource matching for the *tonight* loop. This is the simple
// capacity + distance placeholder the M1 plan calls for: filter nodes that can
// serve the need AND have open capacity, nearest first. The Triage Agent (M2)
// reasons over the person's free-text words and slots in on top of this — the
// flow already captures `words` on the Need so that handoff is clean.
//
// Distance is measured from the FUZZED cell center (privacy.md): we never hold
// a precise point, so "nearest" is necessarily ~250m-granular, which is fine.

import { geocellCenter } from "../../lib/geocell";
import type { NeedType, ResourceNode, ResourceType } from "../../types";

/** Which resource types can serve each need. "talk" has no literal resource
 * type, so it maps to places with people who help (clinics + the library, which
 * seeds a social worker). */
const NEED_TO_RESOURCE: Record<NeedType, ResourceType[]> = {
  bed: ["bed"],
  food: ["food"],
  hygiene: ["hygiene", "water"],
  medical: ["medical"],
  talk: ["medical", "charging-wifi"],
};

export interface RankedNode {
  node: ResourceNode;
  /** Approximate metres from the fuzzed cell center. */
  meters: number;
}

/** Ranked, capacity-filtered matches for a need at a fuzzed cell. */
export function matchNodes(
  need: NeedType,
  fuzzedGeocell: string,
  nodes: ResourceNode[],
): RankedNode[] {
  const allowed = new Set(NEED_TO_RESOURCE[need]);
  const [lng, lat] = geocellCenter(fuzzedGeocell);

  return nodes
    .filter((n) => allowed.has(n.type) && n.capacity_open > 0)
    .map((node) => ({ node, meters: haversineMeters(lat, lng, node.lat, node.lng) }))
    .sort((a, b) => a.meters - b.meters);
}

/** Great-circle distance in metres. */
function haversineMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

/** Capacity tone for the CapacityBadge — color-independent state cue lives in
 * the badge; this just picks the bucket from open/total. */
export function capacityTone(node: ResourceNode): "open" | "filling" | "full" {
  if (node.capacity_open <= 0) return "full";
  if (node.capacity_total > 0 && node.capacity_open / node.capacity_total < 0.15)
    return "filling";
  return "open";
}

/** Rough walking minutes from metres (~80 m/min). */
export function walkingMinutes(meters: number): number {
  return Math.round(meters / 80);
}
