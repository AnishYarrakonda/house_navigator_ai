// Client helper for the "Find help" match crew. POSTs the person's free text +
// fuzzed cell + the resource nodes to /api/match and gets back three picks:
// closest / bestFit / balanced. When the serverless function isn't reachable
// (plain `npm run dev` with no functions, mock mode with no API key, or an
// error) it FALLS BACK to a local heuristic that mirrors the server selector,
// so the UI always returns three sensible picks.
//
// Privacy: the origin is the FUZZED cell center, never a precise point.

import type { ResourceNode } from "../types";
import { geocellCenter } from "./geocell";
import { haversineMeters } from "./routing";
import { matchNodesFromText } from "../features/crisis/matching";

// ~1.35 m/s walking pace (mirrors src/lib/routing.ts and api/match.ts).
const WALK_MPS = 1.35;

/** One of the three returned picks. */
export interface MatchPick {
  node_id: string;
  why: string;
  /** 0–100 fit score. */
  score: number;
  distanceMeters: number;
  etaMinutes: number;
}

export interface MatchResult {
  closest: MatchPick | null;
  bestFit: MatchPick | null;
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
    if (data.closest || data.bestFit || data.balanced) return data;
    return localMatches(words, fuzzed_geocell, resources);
  } catch {
    return localMatches(words, fuzzed_geocell, resources);
  }
}

/**
 * Local fallback mirroring the server selector: infer need types from the words,
 * filter to open candidates of those types, distance-rank, then derive the three
 * picks. Fit here is a simple distance-based proxy (no LLM), so bestFit and
 * closest may coincide — that's fine; the UI handles thin data gracefully.
 */
export function localMatches(
  words: string,
  fuzzed_geocell: string,
  resources: ResourceNode[],
): MatchResult {
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
    return { closest: null, bestFit: null, balanced: null };
  }

  const dists = candidates.map((c) => c.distanceMeters);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const total = (n: ResourceNode) => Math.max(1, n.capacity_total);

  const enriched = candidates.map((c) => {
    // Heuristic fit: more open capacity (relative) + closer reads as a better
    // fit, since we have no LLM here.
    const openRatio = Math.min(1, c.node.capacity_open / total(c.node));
    const normDist = maxD === minD ? 0 : (c.distanceMeters - minD) / (maxD - minD);
    const fit = Math.round(60 + openRatio * 30 + (1 - normDist) * 10);
    const combined = 0.5 * (fit / 100) + 0.5 * (1 - normDist);
    return { ...c, fit, normDist, combined };
  });

  const toPick = (e: (typeof enriched)[number]): MatchPick => ({
    node_id: e.node.id,
    why: e.node.capacity_open > 0
      ? "Open tonight and close to where you are."
      : "A place that can help nearby.",
    score: e.fit,
    distanceMeters: Math.round(e.distanceMeters),
    etaMinutes: Math.max(1, Math.round(e.distanceMeters / WALK_MPS / 60)),
  });

  const closest = enriched.reduce((a, b) =>
    b.distanceMeters < a.distanceMeters ? b : a,
  );
  const bestFit = enriched.reduce((a, b) => (b.fit > a.fit ? b : a));
  const balanced = enriched.reduce((a, b) => (b.combined > a.combined ? b : a));

  return {
    closest: toPick(closest),
    bestFit: toPick(bestFit),
    balanced: toPick(balanced),
  };
}
