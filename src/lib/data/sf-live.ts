// Runtime DataSF augmentation — pulls REAL, live San Francisco resource
// locations from DataSF's free Socrata API and normalizes them into
// ResourceNodes, on top of the curated real baseline (./seed). This is the
// "Live DataSF feeds" source: genuinely-live coordinates, not hand-typed.
//
// Honest constraint (see .claude/rules/data-sources.md): SF publishes location
// feeds, but NO public real-time per-bed availability — so capacity_open here is
// SIMULATED (deterministic per node id so it's stable across reloads). Best
// effort: if DataSF is unreachable (outage, offline, rate limit) we return [] and
// the app falls back to the curated real baseline. Never throws.

import type { ResourceNode } from "../../types";
import { fetchSFPitStops } from "../datasf/pit-stops";

/** Stable pseudo-random 0..1 from a string (so simulated capacity doesn't jump
 *  around on every reload). */
function hash01(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return ((h >>> 0) % 1000) / 1000;
}

/** Pit Stops are staffed toilets/sinks → hygiene nodes. Small fixed capacity. */
function pitStopsToNodes(stops: Awaited<ReturnType<typeof fetchSFPitStops>>): ResourceNode[] {
  const out: ResourceNode[] = [];
  for (const s of stops) {
    const lat = Number(s.location?.latitude);
    const lng = Number(s.location?.longitude);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    const id = `datasf-pitstop-${s.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
    const total = 4;
    const open = Math.round(hash01(id) * total); // SIMULATED
    out.push({
      id,
      name: s.name?.startsWith("Pit Stop") ? s.name : `Pit Stop — ${s.name}`,
      type: "hygiene",
      lat,
      lng,
      capacity_total: total,
      capacity_open: open,
      hours: s.hours,
      notes: [s.neighborhood, "Staffed toilet, sink, needle disposal."]
        .filter(Boolean)
        .join(" · "),
      address: s.address,
    });
  }
  return out;
}

/**
 * Fetch live SF resource locations from DataSF. Returns [] on any failure so the
 * caller keeps the curated real baseline. De-duped by id.
 */
export async function fetchLiveSFNodes(): Promise<ResourceNode[]> {
  try {
    const stops = await fetchSFPitStops({ limit: 500 });
    const nodes = pitStopsToNodes(stops);
    const seen = new Set<string>();
    return nodes.filter((n) => (seen.has(n.id) ? false : (seen.add(n.id), true)));
  } catch {
    return [];
  }
}
