// Match crew — the "Find help" matcher. A person types, in ONE free-text box,
// what they need ("me and my two kids, nowhere safe tonight, can't be split
// up"). A small crew of Claude steps + plain code matches them to the best
// resource listings and returns THREE picks: closest / bestFit / balanced.
//
// Pipeline (2 Claude calls total, for latency):
//   a. INTAKE  (1 Claude call) — parse the free text into a structured profile.
//   b. SCOUT   (plain code)    — type+capacity filter, distance-rank, keep ~8.
//   c. FIT     (1 Claude call) — score the <=8 candidates 0–100 with a warm why.
//   d. SELECTOR(plain code)    — derive closest / bestFit / balanced.
//
// HARD RULES honored here:
//  * NO PII to the model — model inputs route through redactForModel. The crew
//    sees the person's words, a need type, a fuzzed ~250m cell, and public
//    resource data. Never legal names or precise coordinates.
//  * RECOMMENDS ONLY — this returns picks for a human to choose; it never routes
//    or contacts anyone.
//  * Explainable — every pick carries a plain-language `why`.

import type { NeedType, ResourceNode, ResourceType } from "../src/types";
import { redactForModel } from "../src/lib/redaction";
import { runToolAgent, type ToolSpec } from "./_lib/agent";
import { badRequest, json, readJson, serverError } from "./_lib/http";

// ~1.35 m/s walking pace (mirrors src/lib/routing.ts).
const WALK_MPS = 1.35;
const MAX_CANDIDATES = 8;

// ~250m geofuzzing grid resolution in degrees. Mirrors GEOCELL_SIZE_DEG in
// src/config.ts — inlined here so the api build stays isolated from the app's
// vite-typed config (api/tsconfig.json has no vite/client types).
const GEOCELL_SIZE_DEG = 0.00225;
const SF_CENTER = { lat: 37.7749, lng: -122.4194 };

/** Resolve a geocell back to its center [lng, lat]. Mirrors lib/geocell.ts. */
function geocellCenter(cell: string): [number, number] {
  const match = /^g_(-?\d+)_(-?\d+)$/.exec(cell);
  if (!match) return [SF_CENTER.lng, SF_CENTER.lat];
  const row = Number(match[1]);
  const col = Number(match[2]);
  return [(col + 0.5) * GEOCELL_SIZE_DEG, (row + 0.5) * GEOCELL_SIZE_DEG];
}

// Which resource node types plausibly serve each need type (mirrors the
// client-side matching map so SCOUT and the fallback agree).
const NEED_TO_RESOURCE: Record<NeedType, ResourceType[]> = {
  bed: ["bed"],
  food: ["food"],
  hygiene: ["hygiene", "water"],
  medical: ["medical"],
  talk: ["medical", "charging-wifi"],
};

interface MatchBody {
  words: string;
  fuzzed_geocell: string;
  resources: ResourceNode[];
}

/** Structured profile the INTAKE step infers from the free text. */
interface IntakeProfile {
  householdSize: number;
  hasChildren: boolean;
  hasPets: boolean;
  health: string;
  mobility: string;
  urgency: "low" | "medium" | "high";
  needTypes: NeedType[];
  constraints: string[];
}

/** A scored candidate from the FIT step. */
interface FitItem {
  node_id: string;
  fit: number; // 0–100
  why: string;
}

interface FitResult {
  items: FitItem[];
}

/** One of the three returned picks. */
export interface MatchPick {
  node_id: string;
  why: string;
  score: number;
  distanceMeters: number;
  etaMinutes: number;
}

export interface MatchResponse {
  closest: MatchPick | null;
  bestFit: MatchPick | null;
  balanced: MatchPick | null;
}

// ── INTAKE ──────────────────────────────────────────────────────────────────

const INTAKE_SYSTEM = `You are Waypoint's intake reader. A person in crisis has typed, in their own words, what they need tonight. Read it with care and extract a structured profile to help match them to the right place.

You see only the person's words and a need type — never a legal name or precise location, and you must not ask for them.

Infer, conservatively (don't invent facts the words don't support):
- householdSize: total people including the writer (default 1 if unclear).
- hasChildren / hasPets: true only if implied.
- health: any medical / health context in a few words, else "".
- mobility: any mobility limits in a few words, else "".
- urgency: low | medium | high.
- needTypes: which of bed, food, hygiene, medical, talk apply (most-pressing first; at least one).
- constraints: short phrases a volunteer should honor (e.g. "can't be split up", "has a dog", "wheelchair").`;

const INTAKE_TOOL: ToolSpec = {
  name: "submit_profile",
  description: "Submit the structured profile inferred from the person's words.",
  input_schema: {
    type: "object",
    properties: {
      householdSize: { type: "number", description: "Total people, incl. writer. Default 1." },
      hasChildren: { type: "boolean" },
      hasPets: { type: "boolean" },
      health: { type: "string", description: "Short health context, or empty string." },
      mobility: { type: "string", description: "Short mobility context, or empty string." },
      urgency: { type: "string", enum: ["low", "medium", "high"] },
      needTypes: {
        type: "array",
        description: "Subset of: bed, food, hygiene, medical, talk. Most-pressing first.",
        items: { type: "string", enum: ["bed", "food", "hygiene", "medical", "talk"] },
      },
      constraints: {
        type: "array",
        description: "Short phrases a volunteer should honor.",
        items: { type: "string" },
      },
    },
    required: [
      "householdSize",
      "hasChildren",
      "hasPets",
      "health",
      "mobility",
      "urgency",
      "needTypes",
      "constraints",
    ],
  },
};

// ── FIT ──────────────────────────────────────────────────────────────────────

const FIT_SYSTEM = `You are Waypoint's fit scorer. Given a person's situation (a structured profile + their words) and a short list of nearby resource places that are open tonight, score how well each place fits THIS person.

You see only the profile, the words, a fuzzed area cell, and public resource data (name, type, open/total capacity, hours, notes). Never legal names or precise coordinates.

For each place return:
- fit: 0–100, how well it serves this person's situation (needs, household, pets, children, can't-be-split-up, mobility, health). A place with tight capacity or a poor fit scores lower.
- why: one short, warm, plain-language sentence a volunteer could read aloud ("Has family rooms so you can stay together").

Use ONLY node_ids from the provided candidates. Do not invent places.`;

const FIT_TOOL: ToolSpec = {
  name: "submit_fit",
  description: "Submit a fit score and a warm one-line reason for each candidate place.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            node_id: { type: "string", description: "Must be a provided candidate id." },
            fit: { type: "number", description: "0–100 fit score." },
            why: { type: "string", description: "One short, warm, plain-language reason." },
          },
          required: ["node_id", "fit", "why"],
        },
      },
    },
    required: ["items"],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const body = await readJson<MatchBody>(req);
    const words = (body.words ?? "").trim();
    const cell = body.fuzzed_geocell;
    const resources = body.resources ?? [];

    if (!cell) return badRequest("fuzzed_geocell is required.");
    if (resources.length === 0) {
      return json(emptyResponse());
    }

    // ── a. INTAKE — parse the words into a structured profile. ────────────────
    // Route the words through the redaction chokepoint. We borrow a placeholder
    // need type for the redaction shape; the model infers the real needTypes.
    const redactedIntake = redactForModel({
      person: { display_alias: "Friend" },
      need: { type: "bed", words: words || undefined, fuzzed_geocell: cell },
      resources: [],
    });

    let profile: IntakeProfile;
    try {
      const intake = await runToolAgent<IntakeProfile>({
        system: INTAKE_SYSTEM,
        user:
          "Extract the structured profile from this person's words.\n\n" +
          JSON.stringify({ words: redactedIntake.need.words ?? "" }, null, 2),
        tool: INTAKE_TOOL,
        maxTokens: 600,
      });
      profile = normalizeProfile(intake);
    } catch {
      // If intake fails, fall back to a single broad bed need so we still match.
      profile = normalizeProfile(null);
    }

    // ── b. SCOUT — type + capacity filter, distance-rank, keep top ~8. ────────
    const allowed = new Set<ResourceType>(
      profile.needTypes.flatMap((n) => NEED_TO_RESOURCE[n] ?? []),
    );
    const [originLng, originLat] = geocellCenter(cell);

    const scouted = resources
      .filter((n) => allowed.has(n.type) && n.capacity_open > 0)
      .map((node) => ({
        node,
        distanceMeters: haversine(originLat, originLng, node.lat, node.lng),
      }))
      .sort((a, b) => a.distanceMeters - b.distanceMeters)
      .slice(0, MAX_CANDIDATES);

    if (scouted.length === 0) {
      return json(emptyResponse());
    }

    // ── c. FIT — score the <=8 candidates with a warm reason. ─────────────────
    const redactedFit = redactForModel({
      person: { display_alias: "Friend" },
      need: {
        type: profile.needTypes[0] ?? "bed",
        words: words || undefined,
        fuzzed_geocell: cell,
      },
      resources: scouted.map((s) => s.node),
    });

    const validIds = new Set(scouted.map((s) => s.node.id));
    const fitById = new Map<string, FitItem>();
    try {
      const fit = await runToolAgent<FitResult>({
        system: FIT_SYSTEM,
        user:
          "Score how well each nearby place fits this person.\n\n" +
          JSON.stringify({ profile, ...redactedFit }, null, 2),
        tool: FIT_TOOL,
        maxTokens: 1200,
      });
      for (const item of fit.items ?? []) {
        // Drop hallucinated node_ids — keep the model honest about candidates.
        if (validIds.has(item.node_id) && !fitById.has(item.node_id)) {
          fitById.set(item.node_id, item);
        }
      }
    } catch {
      // FIT failed — fall through; SELECTOR uses neutral scores below.
    }

    // ── d. SELECTOR — derive closest / bestFit / balanced. ────────────────────
    const result = select(scouted, fitById);
    return json(result);
  } catch (err) {
    return serverError(err);
  }
}

/** Normalize/clamp an intake profile (or synthesize a neutral one). */
function normalizeProfile(p: IntakeProfile | null): IntakeProfile {
  const NEED_VALUES: NeedType[] = ["bed", "food", "hygiene", "medical", "talk"];
  const needTypes = (p?.needTypes ?? []).filter((n): n is NeedType =>
    NEED_VALUES.includes(n),
  );
  return {
    householdSize: Math.max(1, Math.round(p?.householdSize ?? 1) || 1),
    hasChildren: Boolean(p?.hasChildren),
    hasPets: Boolean(p?.hasPets),
    health: typeof p?.health === "string" ? p.health : "",
    mobility: typeof p?.mobility === "string" ? p.mobility : "",
    urgency:
      p?.urgency === "low" || p?.urgency === "high" ? p.urgency : "medium",
    needTypes: needTypes.length ? needTypes : ["bed"],
    constraints: Array.isArray(p?.constraints) ? p.constraints.slice(0, 6) : [],
  };
}

/** Build the three picks from the scouted candidates + fit data. */
function select(
  scouted: { node: ResourceNode; distanceMeters: number }[],
  fitById: Map<string, FitItem>,
): MatchResponse {
  const dists = scouted.map((s) => s.distanceMeters);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const fits = scouted.map((s) => fitById.get(s.node.id)?.fit ?? 50);
  const minF = Math.min(...fits);
  const maxF = Math.max(...fits);

  const enriched = scouted.map((s) => {
    const fitItem = fitById.get(s.node.id);
    const fit = fitItem?.fit ?? 50;
    const normFit = maxF === minF ? 1 : (fit - minF) / (maxF - minF);
    const normDist = maxD === minD ? 0 : (s.distanceMeters - minD) / (maxD - minD);
    const combined = 0.5 * normFit + 0.5 * (1 - normDist);
    return { ...s, fit, normFit, normDist, combined, fitItem };
  });

  const toPick = (e: (typeof enriched)[number], score: number): MatchPick => ({
    node_id: e.node.id,
    why: e.fitItem?.why ?? defaultWhy(e.node),
    score: Math.round(score),
    distanceMeters: Math.round(e.distanceMeters),
    etaMinutes: Math.max(1, Math.round(e.distanceMeters / WALK_MPS / 60)),
  });

  const closestE = enriched.reduce((a, b) =>
    b.distanceMeters < a.distanceMeters ? b : a,
  );
  const bestFitE = enriched.reduce((a, b) => (b.fit > a.fit ? b : a));
  const balancedE = enriched.reduce((a, b) =>
    b.combined > a.combined ? b : a,
  );

  return {
    closest: toPick(closestE, closestE.fit),
    bestFit: toPick(bestFitE, bestFitE.fit),
    balanced: toPick(balancedE, balancedE.fit),
  };
}

function defaultWhy(node: ResourceNode): string {
  return node.capacity_open > 0
    ? "Open tonight and close to where you are."
    : "A place that can help nearby.";
}

function emptyResponse(): MatchResponse {
  return { closest: null, bestFit: null, balanced: null };
}

/** Great-circle distance in metres. */
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}
