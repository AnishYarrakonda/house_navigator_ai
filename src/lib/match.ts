// Client helper for the "Find help" match crew. POSTs the person's free text +
// fuzzed cell + the resource nodes to /api/match and gets back three picks:
// closest / mostResources / balanced. When the serverless function isn't
// reachable (plain `npm run dev` with no functions, mock mode with no API key,
// or an error) it FALLS BACK to a local heuristic that mirrors the server
// selector, so the UI always returns three sensible picks.
//
// Privacy: the origin is the FUZZED cell center, never a precise point.

import type { ResourceNode } from "../types";
import { geocellCenter } from "./geocell";
import { haversineMeters } from "./routing";
import { matchNodesFromText } from "../features/crisis/matching";

// ~1.35 m/s walking pace (mirrors src/lib/routing.ts and api/match.ts).
const WALK_MPS = 1.35;

import { DEMO_MODE, DEMO_TRIGGER_GEOCELL } from "../demo";

function getDemoResult(): MatchResult {
  return {
    closest: {
      node_id: "node-bed-30-south-beach",
      why: "The closest shelter open right now, but it only has 1 bed available.",
      score: 80,
      resourceScore: 33,
      distanceMeters: 280,
      etaMinutes: 3,
    },
    balanced: {
      node_id: "node-bed-88-dogpatch",
      why: "A tough trade-off: it has 2 beds (short of the 3 you need), but is a much more manageable walk than the larger shelter.",
      score: 60,
      resourceScore: 66,
      distanceMeters: 3425,
      etaMinutes: 42,
    },
    mostResources: {
      node_id: "node-bed-13-inner-richmond",
      why: "This location has 3 beds to fit your whole family perfectly, but it is a very long walk across the city.",
      score: 95,
      resourceScore: 100,
      distanceMeters: 7063,
      etaMinutes: 87,
    }
  };
}

/** One of the three returned picks. */
export interface MatchPick {
  node_id: string;
  why: string;
  /** 0–100 fit score. */
  score: number;
  /** 0–100 how much supply this place has (drives "most resources"). */
  resourceScore: number;
  distanceMeters: number;
  etaMinutes: number;
}

export interface MatchResult {
  closest: MatchPick | null;
  mostResources: MatchPick | null;
  balanced: MatchPick | null;
}

/**
 * Find the three best resource picks for what the person typed. Tries the
 * /api/match crew first; on any failure returns a local heuristic so the UI
 * never breaks.
 */
export async function findMatches(
  words: string,
  fuzzed_geocell: string,
  resources: ResourceNode[],
): Promise<MatchResult> {
  try {
    const res = await fetch("/api/match", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ words, fuzzed_geocell, resources }),
    });
    if (!res.ok) throw new Error(`match ${res.status}`);
    const data = (await res.json()) as MatchResult;
    // If the crew found nothing but we have candidates, the heuristic may still
    // surface something (e.g. the LLM was conservative). Trust a real answer.
    if (data.closest || data.mostResources || data.balanced) return data;
    return localMatches(words, fuzzed_geocell, resources);
  } catch {
    return localMatches(words, fuzzed_geocell, resources);
  }
}

/**
 * Local fallback mirroring the server selector: infer need types from the words,
 * filter to open candidates of those types, distance-rank, then derive the three
 * picks. "Most resources" is the place with the most open supply; "closest" the
 * nearest; "balanced" trades the two off. Picks may coincide on thin data —
 * that's fine; the UI de-dupes gracefully.
 */
export function localMatches(
  words: string,
  fuzzed_geocell: string,
  resources: ResourceNode[],
): MatchResult {
  if (DEMO_MODE && fuzzed_geocell === DEMO_TRIGGER_GEOCELL) {
    return getDemoResult();
  }
  
  const [originLng, originLat] = geocellCenter(fuzzed_geocell);
  const candidates = matchNodesFromText(words, resources)
    .map((node) => ({
      node,
      distanceMeters: haversineMeters(
        { lat: originLat, lng: originLng },
        { lat: node.lat, lng: node.lng },
      ),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters)
    .slice(0, 8);

  if (candidates.length === 0) {
    return { closest: null, mostResources: null, balanced: null };
  }

  const dists = candidates.map((c) => c.distanceMeters);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const opens = candidates.map((c) => c.node.capacity_open);
  const maxOpen = Math.max(1, ...opens);
  const total = (n: ResourceNode) => Math.max(1, n.capacity_total);

  const enriched = candidates.map((c) => {
    // Heuristic fit: more open capacity (relative) + closer reads as a better
    // fit, since we have no LLM here.
    const openRatio = Math.min(1, c.node.capacity_open / total(c.node));
    const normDist = maxD === minD ? 0 : (c.distanceMeters - minD) / (maxD - minD);
    const fit = Math.round(60 + openRatio * 30 + (1 - normDist) * 10);
    // Raw supply (absolute open spots) drives the "most resources" pick.
    const resourceScore = Math.round((c.node.capacity_open / maxOpen) * 100);
    const combined = 0.5 * (fit / 100) + 0.5 * (1 - normDist);
    return { ...c, fit, resourceScore, normDist, combined };
  });

  const toPick = (e: (typeof enriched)[number], why?: string): MatchPick => ({
    node_id: e.node.id,
    why:
      why ??
      (e.node.capacity_open > 0
        ? "Open tonight and close to where you are."
        : "A place that can help nearby."),
    score: e.fit,
    resourceScore: e.resourceScore,
    distanceMeters: Math.round(e.distanceMeters),
    etaMinutes: Math.max(1, Math.round(e.distanceMeters / WALK_MPS / 60)),
  });

  const closest = enriched.reduce((a, b) =>
    b.distanceMeters < a.distanceMeters ? b : a,
  );
  
  const mostResourcesPool = enriched.filter(e => e.node.id !== closest.node.id);
  const mostResources = mostResourcesPool.length > 0 
    ? mostResourcesPool.reduce((a, b) => b.node.capacity_open > a.node.capacity_open ? b : a)
    : closest;

  const balancedPool = enriched.filter(e => e.node.id !== closest.node.id && e.node.id !== mostResources.node.id);
  const balanced = balancedPool.length > 0 
    ? balancedPool.reduce((a, b) => b.combined > a.combined ? b : a)
    : (mostResourcesPool.length > 0 ? mostResources : closest);

  return {
    closest: toPick(closest, "The nearest place open right now."),
    mostResources: toPick(
      mostResources,
      "The most open spots tonight — room to spare if plans change.",
    ),
    balanced: toPick(balanced, "A good balance of close and plenty of room."),
  };
}
