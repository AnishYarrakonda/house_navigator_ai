// The "Find help" crew — a visible, sequential team of Claude agents that a
// person in crisis can watch reason and hand off to each other, ending with
// THREE picks: closest / mostResources (the biggest supply, maybe far) /
// balanced (a good supply at a decent walk).
//
// Pipeline (one streamed Claude call per agent — 3 total, for latency):
//   1. SCOUT     — reads the person's free-text need, infers what they need and
//                  how wide to search; plain code then gathers nearby candidates.
//   2. ANALYST   — weighs each candidate on supply (resourceScore) vs distance.
//   3. PRESENTER — names the three picks and writes a warm one-line reason each.
//
// This streams Server-Sent Events so the UI can show each agent narrating its
// reasoning and the handoff arrows between them (api/_lib/agent.ts ::
// streamNarrationThenTool). Selection of closest/mostResources stays in code so
// the three options are always mathematically honest; the agents supply the
// reasoning and the warm wording.
//
// HARD RULES honored here (mirrors api/match.ts):
//  * NO PII to the model — every model input routes through redactForModel. The
//    crew sees the person's words, a need type, a fuzzed ~250m cell, and public
//    resource data. Never legal names or precise coordinates.
//  * RECOMMENDS ONLY — returns picks for a human to choose; never routes anyone.
//  * Explainable — every pick carries a plain-language `why`.
//  * Resilient — if no API key or any step fails, a local heuristic still
//    produces the three picks and synthetic narration so the demo never breaks.

import type { NeedType, ResourceNode, ResourceType } from "../src/types";
import { redactForModel } from "../src/lib/redaction";
import { streamNarrationThenTool, type ToolSpec } from "./_lib/agent";
import { badRequest, readJson } from "./_lib/http";

const WALK_MPS = 1.35; // ~walking pace (mirrors src/lib/routing.ts, api/match.ts)
const MAX_CANDIDATES = 10;

// ~250m geofuzzing grid resolution in degrees (mirrors GEOCELL_SIZE_DEG in
// src/config.ts — inlined so the api build stays isolated from vite config).
const GEOCELL_SIZE_DEG = 0.00225;
const SF_CENTER = { lat: 37.7749, lng: -122.4194 };

const NEED_TO_RESOURCE: Record<NeedType, ResourceType[]> = {
  bed: ["bed"],
  food: ["food"],
  hygiene: ["hygiene", "water"],
  medical: ["medical"],
  talk: ["medical", "charging-wifi"],
};

// ── Shapes ────────────────────────────────────────────────────────────────────

interface CrewBody {
  words: string;
  fuzzed_geocell: string;
  resources: ResourceNode[];
}

export interface CrewPick {
  node_id: string;
  why: string;
  /** 0–100 overall fit. */
  score: number;
  /** 0–100 how much supply this place has (drives the "most resources" pick). */
  resourceScore: number;
  distanceMeters: number;
  etaMinutes: number;
}

export interface CrewResult {
  closest: CrewPick | null;
  mostResources: CrewPick | null;
  balanced: CrewPick | null;
}

type AgentId = "scout" | "analyst" | "presenter";

/** One SSE event sent to the browser. */
type CrewEvent =
  | { type: "agent_start"; agent: AgentId; title: string; blurb: string }
  | { type: "token"; agent: AgentId; text: string }
  | { type: "handoff"; from: AgentId; to: AgentId; summary: string }
  | { type: "result"; result: CrewResult }
  | { type: "error"; message: string }
  | { type: "done" };

type Send = (event: CrewEvent) => void;

// Structured handoff payloads from each agent's tool call.
interface ScoutHandoff {
  needSummary: string;
  needTypes: NeedType[];
  radiusMeters: number;
  constraints: string[];
}
interface AnalystItem {
  node_id: string;
  resourceScore: number; // 0–100, supply at this place
  fit: number; // 0–100, fit for this person
  note: string;
}
interface AnalystHandoff {
  items: AnalystItem[];
}
interface PresenterSlot {
  node_id: string;
  why: string;
}
interface PresenterHandoff {
  closest: PresenterSlot;
  mostResources: PresenterSlot;
  balanced: PresenterSlot;
}

// ── SCOUT ──────────────────────────────────────────────────────────────────────

const SCOUT_SYSTEM = `You are Scout, the first agent of Waypoint's "Find help" crew. A person in crisis has typed, in their own words, what they need tonight. You read it with care and decide what to look for.

You see only the person's words and a fuzzed area cell — never a legal name or precise location, and you must not ask for them.

FIRST, narrate your reasoning out loud in 2–3 short, warm, plain sentences ("Reading what you wrote… it sounds like you need a safe bed for you and your kids tonight. I'll search shelters within about a kilometre and hand the best options to Analyst."). THEN call submit_scout with the structured handoff. Always narrate first, then call the tool.

Infer conservatively (don't invent facts the words don't support):
- needTypes: which of bed, food, hygiene, medical, talk apply (most-pressing first; at least one).
- radiusMeters: how wide to search on foot (typically 800–2500).
- constraints: short phrases a volunteer should honor ("can't be split up", "has a dog", "wheelchair").`;

const SCOUT_TOOL: ToolSpec = {
  name: "submit_scout",
  description: "Hand off what to search for to the Analyst agent.",
  input_schema: {
    type: "object",
    properties: {
      needSummary: { type: "string", description: "One short sentence summarizing the need." },
      needTypes: {
        type: "array",
        description: "Subset of: bed, food, hygiene, medical, talk. Most-pressing first.",
        items: { type: "string", enum: ["bed", "food", "hygiene", "medical", "talk"] },
      },
      radiusMeters: { type: "number", description: "Walking search radius, ~800–2500." },
      constraints: {
        type: "array",
        description: "Short phrases a volunteer should honor.",
        items: { type: "string" },
      },
    },
    required: ["needSummary", "needTypes", "radiusMeters", "constraints"],
  },
};

// ── ANALYST ─────────────────────────────────────────────────────────────────────

const ANALYST_SYSTEM = `You are Analyst, the second agent of Waypoint's crew. Scout handed you a person's situation and a short list of nearby places that are open tonight. You weigh each place on two axes the person cares about: how MUCH it can offer (supply) and how FAR it is.

You see only the need, the constraints, a fuzzed area cell, and public resource data (name, type, open/total capacity, hours, notes). Never legal names or precise coordinates.

FIRST, narrate your reasoning out loud in 2–3 short, plain sentences naming the tradeoff you see ("The Mission shelter has the most beds but it's a 20-minute walk; the closer one is smaller. I'll pass both forward."). THEN call submit_analysis. Always narrate first, then call the tool.

For each place return:
- resourceScore: 0–100, how much supply it has for this need (more open capacity / richer notes = higher). This drives the "most resources" option.
- fit: 0–100, how well it serves THIS person's situation (needs, household, pets, children, can't-be-split-up, mobility, health). Tight capacity or poor fit scores lower.
- note: one short plain phrase about this place.

Use ONLY node_ids from the provided candidates. Do not invent places.`;

const ANALYST_TOOL: ToolSpec = {
  name: "submit_analysis",
  description: "Hand off a supply + fit assessment for each candidate to the Presenter.",
  input_schema: {
    type: "object",
    properties: {
      items: {
        type: "array",
        items: {
          type: "object",
          properties: {
            node_id: { type: "string", description: "Must be a provided candidate id." },
            resourceScore: { type: "number", description: "0–100 supply at this place." },
            fit: { type: "number", description: "0–100 fit for this person." },
            note: { type: "string", description: "One short plain phrase." },
          },
          required: ["node_id", "resourceScore", "fit", "note"],
        },
      },
    },
    required: ["items"],
  },
};

// ── PRESENTER ───────────────────────────────────────────────────────────────────

const PRESENTER_SYSTEM = `You are Presenter, the final agent of Waypoint's crew. Analyst handed you scored places. You present THREE options to the person, each with a warm one-line reason they could read on a hard night:
- closest: the nearest place that can help.
- mostResources: the place with the most supply, even if it's a longer walk.
- balanced: a place with good supply at a reasonable walking distance.

FIRST, narrate your reasoning out loud in 2–3 short, warm sentences as you make the call ("Here's what I'd suggest…"). THEN call submit_picks. Always narrate first, then call the tool.

For each pick: a node_id from the candidates and a 'why' — one short, warm, plain-language sentence a volunteer could read aloud ("Has family rooms so you can stay together, about a 10-minute walk."). Use ONLY provided node_ids.`;

const PRESENTER_TOOL: ToolSpec = {
  name: "submit_picks",
  description: "Present the three final picks with a warm reason each.",
  input_schema: {
    type: "object",
    properties: {
      closest: slotSchema("The nearest helpful place."),
      mostResources: slotSchema("The place with the most supply, even if farther."),
      balanced: slotSchema("Good supply at a reasonable walk."),
    },
    required: ["closest", "mostResources", "balanced"],
  },
};

function slotSchema(desc: string) {
  return {
    type: "object",
    description: desc,
    properties: {
      node_id: { type: "string", description: "A provided candidate id." },
      why: { type: "string", description: "One short, warm, plain-language reason." },
    },
    required: ["node_id", "why"],
  };
}

// ── Handler ─────────────────────────────────────────────────────────────────────

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  const body = await readJson<CrewBody>(req);
  if (!body.fuzzed_geocell) return badRequest("fuzzed_geocell is required.");

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send: Send = (event) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(event)}\n\n`));
      };
      try {
        await runCrew(body, send);
      } catch (err) {
        send({ type: "error", message: err instanceof Error ? err.message : String(err) });
      } finally {
        send({ type: "done" });
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "content-type": "text/event-stream; charset=utf-8",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
    },
  });
}

// ── Orchestration ───────────────────────────────────────────────────────────────

async function runCrew(body: CrewBody, send: Send): Promise<void> {
  const words = (body.words ?? "").trim();
  const cell = body.fuzzed_geocell;
  const resources = body.resources ?? [];
  const [originLng, originLat] = geocellCenter(cell);

  const hasKey = Boolean(process.env.ANTHROPIC_API_KEY);

  // If we can't reach the model at all, run the whole thing locally with
  // synthetic narration so the panel still animates and returns three picks.
  if (!hasKey) {
    await runLocalCrew(words, cell, resources, originLat, originLng, send);
    return;
  }

  try {
    // ── 1. SCOUT ────────────────────────────────────────────────────────────
    send({
      type: "agent_start",
      agent: "scout",
      title: "Scout",
      blurb: "Reading what you need and where to look",
    });

    const redactedScout = redactForModel({
      person: { display_alias: "Friend" },
      need: { type: "bed", words: words || undefined, fuzzed_geocell: cell },
      resources: [],
    });

    const scout = await streamNarrationThenTool<ScoutHandoff>({
      system: SCOUT_SYSTEM,
      user:
        "Read this person's words and decide what to search for.\n\n" +
        JSON.stringify({ words: redactedScout.need.words ?? "" }, null, 2),
      tool: SCOUT_TOOL,
      maxTokens: 500,
      onToken: (text) => send({ type: "token", agent: "scout", text }),
    });

    const needTypes = normalizeNeedTypes(scout.data?.needTypes);
    const radiusMeters = clampRadius(scout.data?.radiusMeters);

    // Plain code gathers the candidate pool Scout described.
    const allowed = new Set<ResourceType>(
      needTypes.flatMap((n) => NEED_TO_RESOURCE[n] ?? []),
    );
    const candidates = gatherCandidates(resources, allowed, originLat, originLng, radiusMeters);

    if (candidates.length === 0) {
      send({ type: "result", result: emptyResult() });
      return;
    }

    send({
      type: "handoff",
      from: "scout",
      to: "analyst",
      summary: `Found ${candidates.length} place${candidates.length === 1 ? "" : "s"} nearby — handing off to Analyst to weigh supply vs. distance.`,
    });

    // ── 2. ANALYST ──────────────────────────────────────────────────────────
    send({
      type: "agent_start",
      agent: "analyst",
      title: "Analyst",
      blurb: "Weighing supply against distance",
    });

    const redactedAnalyst = redactForModel({
      person: { display_alias: "Friend" },
      need: { type: needTypes[0] ?? "bed", words: words || undefined, fuzzed_geocell: cell },
      resources: candidates.map((c) => c.node),
    });

    const candidateView = candidates.map((c, i) => ({
      ...redactedAnalyst.resources[i],
      distanceMeters: Math.round(c.distanceMeters),
    }));

    const analyst = await streamNarrationThenTool<AnalystHandoff>({
      system: ANALYST_SYSTEM,
      user:
        "Weigh each candidate on supply (resourceScore) and fit.\n\n" +
        JSON.stringify(
          { need: redactedAnalyst.need, constraints: scout.data?.constraints ?? [], candidates: candidateView },
          null,
          2,
        ),
      tool: ANALYST_TOOL,
      maxTokens: 1000,
      onToken: (text) => send({ type: "token", agent: "analyst", text }),
    });

    const validIds = new Set(candidates.map((c) => c.node.id));
    const analysisById = new Map<string, AnalystItem>();
    for (const item of analyst.data?.items ?? []) {
      if (validIds.has(item.node_id) && !analysisById.has(item.node_id)) {
        analysisById.set(item.node_id, item);
      }
    }

    send({
      type: "handoff",
      from: "analyst",
      to: "presenter",
      summary: "Scored every option — handing off to Presenter to pick the three best.",
    });

    // ── 3. PRESENTER ────────────────────────────────────────────────────────
    send({
      type: "agent_start",
      agent: "presenter",
      title: "Presenter",
      blurb: "Choosing your three options",
    });

    // Code derives the canonical three picks so they're always honest; the
    // Presenter supplies the warm wording.
    const enriched = enrich(candidates, analysisById);
    const picks = selectThree(enriched);

    const presenterView = enriched.map((e) => ({
      node_id: e.node.id,
      name: e.node.name,
      resourceScore: e.resourceScore,
      fit: e.fit,
      distanceMeters: Math.round(e.distanceMeters),
      etaMinutes: e.etaMinutes,
    }));

    const presenter = await streamNarrationThenTool<PresenterHandoff>({
      system: PRESENTER_SYSTEM,
      user:
        "Present the three options with a warm reason each. Suggested picks " +
        "(you may keep or adjust the wording): " +
        JSON.stringify(
          {
            suggested: {
              closest: picks.closest?.node_id,
              mostResources: picks.mostResources?.node_id,
              balanced: picks.balanced?.node_id,
            },
            candidates: presenterView,
          },
          null,
          2,
        ),
      tool: PRESENTER_TOOL,
      maxTokens: 700,
      onToken: (text) => send({ type: "token", agent: "presenter", text }),
    });

    const result = applyPresenterWhys(picks, presenter.data, validIds, enriched);
    send({ type: "result", result });
  } catch (err) {
    // Any step failed mid-crew — degrade to the local heuristic so the person
    // still gets three options.
    send({
      type: "token",
      agent: "presenter",
      text: "\n(Falling back to a quick local match…)",
    });
    const result = localSelect(words, resources, originLat, originLng);
    send({ type: "result", result });
    // Swallow — the error is already surfaced as a graceful fallback.
    void err;
  }
}

// ── Candidate gathering + selection (shared by live + local paths) ──────────────

interface Candidate {
  node: ResourceNode;
  distanceMeters: number;
}

interface Enriched extends Candidate {
  resourceScore: number;
  fit: number;
  etaMinutes: number;
  note?: string;
}

/** Type+capacity filter, distance-rank, keep the nearest MAX_CANDIDATES. The
 *  radius is a soft hint: we keep within-radius places first but never return
 *  empty if any open candidate of the right type exists. */
function gatherCandidates(
  resources: ResourceNode[],
  allowed: Set<ResourceType>,
  originLat: number,
  originLng: number,
  radiusMeters: number,
): Candidate[] {
  const open = resources
    .filter((n) => allowed.has(n.type) && n.capacity_open > 0)
    .map((node) => ({
      node,
      distanceMeters: haversine(originLat, originLng, node.lat, node.lng),
    }))
    .sort((a, b) => a.distanceMeters - b.distanceMeters);

  const within = open.filter((c) => c.distanceMeters <= radiusMeters);
  const pool = within.length > 0 ? within : open;
  return pool.slice(0, MAX_CANDIDATES);
}

/** Attach a supply score + fit to each candidate (from the Analyst, or derived). */
function enrich(candidates: Candidate[], analysisById: Map<string, AnalystItem>): Enriched[] {
  return candidates.map((c) => {
    const item = analysisById.get(c.node.id);
    const resourceScore = clamp01to100(
      item?.resourceScore ?? derivedResourceScore(c.node),
    );
    const fit = clamp01to100(item?.fit ?? 60);
    return {
      ...c,
      resourceScore,
      fit,
      etaMinutes: Math.max(1, Math.round(c.distanceMeters / WALK_MPS / 60)),
      note: item?.note,
    };
  });
}

/** Supply proxy when the model didn't score a node: total capacity, scaled. */
function derivedResourceScore(node: ResourceNode): number {
  // Open spots matter most; total capacity is the ceiling of supply.
  return clamp01to100(Math.min(100, node.capacity_open * 6 + node.capacity_total * 2));
}

/** Derive closest / mostResources / balanced from the enriched candidates. */
function selectThree(enriched: Enriched[]): CrewResult {
  if (enriched.length === 0) return emptyResult();

  const dists = enriched.map((e) => e.distanceMeters);
  const minD = Math.min(...dists);
  const maxD = Math.max(...dists);
  const supplies = enriched.map((e) => e.resourceScore);
  const minS = Math.min(...supplies);
  const maxS = Math.max(...supplies);

  const scored = enriched.map((e) => {
    const normDist = maxD === minD ? 0 : (e.distanceMeters - minD) / (maxD - minD);
    const normSupply = maxS === minS ? 1 : (e.resourceScore - minS) / (maxS - minS);
    const combined = 0.5 * normSupply + 0.5 * (1 - normDist);
    return { e, combined };
  });

  const closest = enriched.reduce((a, b) => (b.distanceMeters < a.distanceMeters ? b : a));
  const mostResources = enriched.reduce((a, b) => (b.resourceScore > a.resourceScore ? b : a));
  const balanced = scored.reduce((a, b) => (b.combined > a.combined ? b : a)).e;

  return {
    closest: toPick(closest),
    mostResources: toPick(mostResources),
    balanced: toPick(balanced),
  };
}

function toPick(e: Enriched): CrewPick {
  return {
    node_id: e.node.id,
    why: e.note ?? defaultWhy(e.node),
    score: Math.round(e.fit),
    resourceScore: Math.round(e.resourceScore),
    distanceMeters: Math.round(e.distanceMeters),
    etaMinutes: e.etaMinutes,
  };
}

/** Overlay the Presenter's warm `why`s onto the code-chosen picks. We keep the
 *  honest node selection but use the model's wording when it named that node. */
function applyPresenterWhys(
  picks: CrewResult,
  handoff: PresenterHandoff | null,
  validIds: Set<string>,
  enriched: Enriched[],
): CrewResult {
  if (!handoff) return picks;
  const whyFor = (slot: PresenterSlot | undefined, pick: CrewPick | null): CrewPick | null => {
    if (!pick) return null;
    if (slot && validIds.has(slot.node_id) && slot.node_id === pick.node_id && slot.why?.trim()) {
      return { ...pick, why: slot.why.trim() };
    }
    return pick;
  };
  void enriched;
  return {
    closest: whyFor(handoff.closest, picks.closest),
    mostResources: whyFor(handoff.mostResources, picks.mostResources),
    balanced: whyFor(handoff.balanced, picks.balanced),
  };
}

// ── Local fallback (no API key, or a mid-crew failure) ──────────────────────────

async function runLocalCrew(
  words: string,
  cell: string,
  resources: ResourceNode[],
  originLat: number,
  originLng: number,
  send: Send,
): Promise<void> {
  void cell;
  // Animate the three agents with synthetic narration so the demo still reads as
  // a crew, then return the local heuristic picks.
  const beats: Array<{ agent: AgentId; title: string; blurb: string; line: string; handoffTo?: AgentId; handoff?: string }> = [
    {
      agent: "scout",
      title: "Scout",
      blurb: "Reading what you need and where to look",
      line: "Reading what you wrote and looking for open places near you tonight.",
      handoffTo: "analyst",
      handoff: "Gathered the nearby options — handing off to Analyst.",
    },
    {
      agent: "analyst",
      title: "Analyst",
      blurb: "Weighing supply against distance",
      line: "Weighing how much each place can offer against how far it is to walk.",
      handoffTo: "presenter",
      handoff: "Scored every option — handing off to Presenter.",
    },
    {
      agent: "presenter",
      title: "Presenter",
      blurb: "Choosing your three options",
      line: "Here are the closest place, the one with the most supply, and a balanced choice.",
    },
  ];

  for (const beat of beats) {
    send({ type: "agent_start", agent: beat.agent, title: beat.title, blurb: beat.blurb });
    for (const chunk of chunkText(beat.line)) {
      send({ type: "token", agent: beat.agent, text: chunk });
      await delay(28);
    }
    if (beat.handoffTo && beat.handoff) {
      send({ type: "handoff", from: beat.agent, to: beat.handoffTo, summary: beat.handoff });
    }
  }

  send({ type: "result", result: localSelect(words, resources, originLat, originLng) });
}

/** Local heuristic mirroring selectThree without the model (used as a safety net). */
function localSelect(
  words: string,
  resources: ResourceNode[],
  originLat: number,
  originLng: number,
): CrewResult {
  const allowed = new Set<ResourceType>(
    inferNeedTypes(words).flatMap((n) => NEED_TO_RESOURCE[n] ?? []),
  );
  const candidates = gatherCandidates(resources, allowed, originLat, originLng, 4000);
  if (candidates.length === 0) return emptyResult();
  const enriched = enrich(candidates, new Map());
  return selectThree(enriched);
}

/** Keyword need-type inference for the no-model path (broad on purpose). */
function inferNeedTypes(words: string): NeedType[] {
  const w = words.toLowerCase();
  const out: NeedType[] = [];
  if (/\b(bed|sleep|shelter|stay|night|safe|warm|roof|housing)\b/.test(w)) out.push("bed");
  if (/\b(food|eat|hungry|meal|grocery|pantry)\b/.test(w)) out.push("food");
  if (/\b(shower|wash|hygiene|toilet|bathroom|clean|water)\b/.test(w)) out.push("hygiene");
  if (/\b(doctor|medical|sick|hurt|clinic|medicine|nurse|pain)\b/.test(w)) out.push("medical");
  if (/\b(talk|alone|scared|help|someone)\b/.test(w)) out.push("talk");
  return out.length ? out : ["bed"];
}

// ── Small helpers ───────────────────────────────────────────────────────────────

function normalizeNeedTypes(types: NeedType[] | undefined): NeedType[] {
  const valid: NeedType[] = ["bed", "food", "hygiene", "medical", "talk"];
  const out = (types ?? []).filter((t): t is NeedType => valid.includes(t));
  return out.length ? out : ["bed"];
}

function clampRadius(r: number | undefined): number {
  if (typeof r !== "number" || !Number.isFinite(r)) return 1500;
  return Math.min(5000, Math.max(500, Math.round(r)));
}

function clamp01to100(n: number): number {
  if (!Number.isFinite(n)) return 50;
  return Math.min(100, Math.max(0, n));
}

function defaultWhy(node: ResourceNode): string {
  return node.capacity_open > 0
    ? "Open tonight and able to help."
    : "A place that can help nearby.";
}

function emptyResult(): CrewResult {
  return { closest: null, mostResources: null, balanced: null };
}

/** Resolve a geocell back to its center [lng, lat]. Mirrors lib/geocell.ts. */
function geocellCenter(cell: string): [number, number] {
  const match = /^g_(-?\d+)_(-?\d+)$/.exec(cell);
  if (!match) return [SF_CENTER.lng, SF_CENTER.lat];
  const row = Number(match[1]);
  const col = Number(match[2]);
  return [(col + 0.5) * GEOCELL_SIZE_DEG, (row + 0.5) * GEOCELL_SIZE_DEG];
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

function chunkText(text: string): string[] {
  return text.match(/\S+\s*/g) ?? [text];
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
