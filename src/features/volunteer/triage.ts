// Triage recommendation surfacing for the co-pilot HITL step.
//
// In `live` mode the real Triage runtime agent (Lane 4) reasons over the
// person's own words + live capacity and writes a ranked recommendation with a
// plain-language rationale (see .claude/rules/ai-agents.md). The co-pilot
// CONFIRMS it — the agent never acts on a person itself.
//
// Until that endpoint is wired, this module derives an equivalent ranked
// recommendation locally from public node data so the HITL confirm flow is
// demoable in `mock` mode. It is intentionally a stand-in: it still returns a
// rationale and a confidence, and it is still only ever a *recommendation* a
// human confirms. It reads no PII — only the need type, the fuzzed cell, and
// public resource_node rows.

import type { NeedType, ResourceNode } from "../../types";
import { cellCenter, formatMiles, metersBetween } from "./format";

/** Which resource types can satisfy a given need type. */
const NEED_TO_RESOURCE: Record<NeedType, ResourceNode["type"][]> = {
  bed: ["bed"],
  food: ["food"],
  hygiene: ["hygiene", "water"],
  medical: ["medical"],
  talk: ["medical", "charging-wifi"],
};

export interface TriageOption {
  node: ResourceNode;
  /** Rough distance from the fuzzed cell, in miles. */
  miles: number;
  /** 0–1 score used only to rank — never shown as a bare number. */
  score: number;
}

export interface TriageRecommendation {
  options: TriageOption[];
  /** Plain-language reasoning shown to the co-pilot (never a bare list). */
  rationale: string;
  /** 0–1; a low value should route to a human queue rather than auto-suggest. */
  confidence: number;
}

const CONFIDENCE_FLOOR = 0.4;

/**
 * Rank candidate nodes for a need. Prefers matching type, real open capacity,
 * and proximity to the fuzzed cell. Returns up to `limit` options plus a
 * written rationale and a confidence. Pure + synchronous so the UI can show it
 * the instant a co-pilot accepts.
 */
export function recommendForNeed(
  needType: NeedType,
  fuzzedGeocell: string,
  nodes: ResourceNode[],
  words?: string,
  limit = 3,
): TriageRecommendation {
  const center = cellCenter(fuzzedGeocell);
  const allowed = new Set(NEED_TO_RESOURCE[needType]);

  const scored: TriageOption[] = nodes
    .filter((n) => allowed.has(n.type))
    .map((node) => {
      const meters = metersBetween(center, { lat: node.lat, lng: node.lng });
      const miles = meters / 1609.344;
      // Proximity term (closer is better, ~3mi horizon) + capacity term.
      const proximity = Math.max(0, 1 - miles / 3);
      const hasRoom = node.capacity_open > 0;
      const capacityRatio =
        node.capacity_total > 0
          ? node.capacity_open / node.capacity_total
          : 0;
      const score =
        (hasRoom ? 0.55 : 0) + 0.3 * proximity + 0.15 * capacityRatio;
      return { node, miles, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);

  const top = scored[0];
  const confidence = top ? Math.min(0.95, 0.45 + top.score / 2) : 0;

  return {
    options: scored,
    confidence,
    rationale: buildRationale(scored, words, confidence),
  };
}

/** True when confidence is too low to recommend — escalate to a human queue. */
export function shouldEscalate(rec: TriageRecommendation): boolean {
  return rec.confidence < CONFIDENCE_FLOOR || rec.options.length === 0;
}

function buildRationale(
  options: TriageOption[],
  words: string | undefined,
  confidence: number,
): string {
  if (options.length === 0) {
    return "No matching site has space right now — flagging for a human to call around.";
  }
  const top = options[0];
  const room =
    top.node.capacity_open > 0
      ? `${top.node.capacity_open} open now`
      : "currently full — worth a call to confirm";
  const parts = [
    `${top.node.name} is closest (${formatMiles(top.miles)}) and ${room}.`,
  ];
  if (top.node.hours) parts.push(`Hours: ${top.node.hours}.`);
  if (words && /dog|pet|cat/i.test(words)) {
    parts.push("Note: they mentioned a pet — confirm the site is pet-friendly.");
  }
  if (words && /(kid|child|son|daughter|6-year|family)/i.test(words)) {
    parts.push("Note: a child is with them — keep the group together.");
  }
  if (confidence < 0.6) {
    parts.push("Lower confidence — double-check capacity before you confirm.");
  }
  return parts.join(" ");
}
