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

/** Keyword → need-type cues for inferring needs from one free-text box. This is
 * the no-LLM fallback the match crew degrades to; the server INTAKE agent does
 * the real reasoning. Order roughly by how literal the cue is. */
const NEED_KEYWORDS: Record<NeedType, string[]> = {
  bed: ["bed", "sleep", "shelter", "stay", "night", "tonight", "safe", "roof", "housing", "rest"],
  food: ["food", "eat", "hungry", "meal", "groceries", "pantry"],
  hygiene: ["shower", "wash", "bathroom", "toilet", "hygiene", "clean", "water", "thirsty"],
  medical: ["medical", "doctor", "nurse", "sick", "hurt", "pain", "meds", "medicine", "clinic", "injured"],
  talk: ["talk", "someone", "alone", "scared", "help me", "counsel", "social worker"],
};

/** Infer which need types the person's free text implies. Defaults to ["bed"]
 * (somewhere safe tonight) when nothing else matches — the most common ask. */
export function inferNeedTypes(words: string): NeedType[] {
  const text = words.toLowerCase();
  const hits: NeedType[] = [];
  for (const need of ["bed", "medical", "food", "hygiene", "talk"] as NeedType[]) {
    if (NEED_KEYWORDS[need].some((kw) => text.includes(kw))) hits.push(need);
  }
  return hits.length ? hits : ["bed"];
}

/** Capacity-filter `nodes` to those that can serve the need types inferred from
 * the free text. Returns the matching nodes (unsorted) — callers rank them. */
export function matchNodesFromText(
  words: string,
  nodes: ResourceNode[],
): ResourceNode[] {
  const needs = inferNeedTypes(words);
  const allowed = new Set<ResourceType>(
    needs.flatMap((n) => NEED_TO_RESOURCE[n]),
  );
  return nodes.filter((n) => allowed.has(n.type) && n.capacity_open > 0);
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
