// Triage agent — the showcase reasoning task (ai-agents.md §B). HITL.
//
// Fires when a person opens a need. Reads the person's OWN WORDS + constraints
// ("I have my dog and a 6-year-old, can't be split up") and reasons over live
// capacity / hours / eligibility / rough distance to RANK resource options,
// each with a plain-language reason, plus an overall rationale and a calibrated
// confidence. Low confidence → flagged for the human queue.
//
// HARD RULES honored here:
//  * RECOMMENDS ONLY — never routes anyone. A human co-pilot confirms (claimNeed
//    / confirmResource in the data layer) before anyone is moved.
//  * NO PII to the model — every model input goes through redactForModel. The
//    agent sees an alias, the need type, the person's words, a fuzzed ~250m
//    cell, and public resource data. Never legal names or precise coordinates.
//  * Explainable — the recommendation + rationale + confidence are persisted on
//    the need (triage_* columns) as the audit trail Lane 3 renders.

import type { NeedType, ResourceNode } from "../src/types";
import {
  redactForModel,
  type RedactedModelInput,
} from "../src/lib/redaction";
import { runToolAgent, type ToolSpec } from "./_lib/agent";
import { badRequest, json, readJson, serverError } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase-admin";

// Below this confidence, we don't trust the auto-recommendation — it goes to a
// human queue instead of guessing (ai-agents.md: "low confidence escalates").
const TRIAGE_CONFIDENCE_THRESHOLD = 0.5;

// Which resource node types are plausible candidates for each need type.
const CANDIDATE_TYPES: Record<NeedType, ResourceNode["type"][]> = {
  bed: ["bed"],
  food: ["food"],
  hygiene: ["hygiene", "water"],
  medical: ["medical"],
  talk: ["medical", "charging-wifi"],
};

interface TriageBody {
  /** DB mode: look the need + candidates up from Supabase. */
  needId?: string;
  /** Direct mode (no DB): caller supplies the redaction inputs itself. */
  person?: { display_alias: string };
  need?: { type: NeedType; words?: string; fuzzed_geocell: string };
  resources?: ResourceNode[];
}

interface TriageOption {
  node_id: string;
  score: number;
  why: string;
}
interface TriageResult {
  options: TriageOption[];
  rationale: string;
  confidence: number;
}

const SYSTEM = `You are Waypoint's Triage agent. You help a person in crisis find somewhere safe by RECOMMENDING resource options — you never route or contact anyone yourself; a human co-pilot confirms first.

You see only: an alias, the need type, the person's own words, a fuzzed ~250m area cell, and public resource data (name, type, live open/total capacity, hours, notes). You will NEVER be given legal names or precise coordinates — do not ask for them.

Rank the candidate resources for this need. Reason over: live capacity (prefer places with open spots; a full place ranks low), hours, eligibility/fit, and the person's words and constraints (pets, children, can't-be-split-up, mobility, language). Use ONLY node_ids from the provided candidates.

Return each option with a 0–100 fit score and a short, warm, plain-language reason a volunteer could read aloud. Give an overall rationale. Set a calibrated confidence in [0,1]: lower it when no candidate clearly satisfies the stated constraints, when capacity is tight, or when the words are ambiguous.`;

const TOOL: ToolSpec = {
  name: "submit_triage",
  description:
    "Submit the ranked resource options for this need, with reasons, an overall rationale, and a calibrated confidence.",
  input_schema: {
    type: "object",
    properties: {
      options: {
        type: "array",
        description: "Ranked best-first. node_id must be a provided candidate.",
        items: {
          type: "object",
          properties: {
            node_id: { type: "string" },
            score: { type: "number", description: "0–100 fit score" },
            why: {
              type: "string",
              description: "Short plain-language reason for this ranking",
            },
          },
          required: ["node_id", "score", "why"],
        },
      },
      rationale: {
        type: "string",
        description: "Overall plain-language rationale shown to the co-pilot.",
      },
      confidence: {
        type: "number",
        description: "Overall confidence in [0,1].",
      },
    },
    required: ["options", "rationale", "confidence"],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const body = await readJson<TriageBody>(req);

    // Assemble the redaction inputs — either from the DB (needId) or directly.
    let redactionInput: Parameters<typeof redactForModel>[0];
    const needId: string | undefined = body.needId;

    if (needId) {
      const sb = getSupabaseAdmin();
      const { data: needRow, error: needErr } = await sb
        .from("need")
        .select("id, person_id, type, words, fuzzed_geocell")
        .eq("id", needId)
        .single();
      if (needErr || !needRow) return badRequest(`Need not found: ${needId}`);

      const { data: personRow } = await sb
        .from("person")
        .select("display_alias")
        .eq("id", needRow.person_id)
        .single();

      const wantedTypes = CANDIDATE_TYPES[needRow.type as NeedType] ?? [];
      const { data: nodeRows } = await sb
        .from("resource_node")
        .select("*")
        .in("type", wantedTypes.length ? wantedTypes : ["bed"]);

      redactionInput = {
        person: { display_alias: personRow?.display_alias ?? "Friend" },
        need: {
          type: needRow.type as NeedType,
          words: needRow.words ?? undefined,
          fuzzed_geocell: needRow.fuzzed_geocell,
        },
        resources: (nodeRows ?? []) as ResourceNode[],
      };
    } else if (body.person && body.need) {
      redactionInput = {
        person: { display_alias: body.person.display_alias },
        need: body.need,
        resources: body.resources ?? [],
      };
    } else {
      return badRequest(
        "Provide either { needId } or { person, need, resources }.",
      );
    }

    // THE CHOKEPOINT: strip everything but the allow-listed fields before the
    // model ever sees it. No raw rows are hand-assembled into the prompt.
    const redacted: RedactedModelInput = redactForModel(redactionInput);

    if (redacted.resources.length === 0) {
      return badRequest("No candidate resources for this need type.");
    }

    const result = await runToolAgent<TriageResult>({
      system: SYSTEM,
      user:
        "Recommend resource options for this need. Use only the candidate node_ids.\n\n" +
        JSON.stringify(redacted, null, 2),
      tool: TOOL,
    });

    // Drop any hallucinated node_ids; keep the model honest about candidates.
    const validIds = new Set(redacted.resources.map((r) => r.id));
    const options = result.options.filter((o) => validIds.has(o.node_id));

    const confidence = clamp01(result.confidence);
    const status =
      confidence < TRIAGE_CONFIDENCE_THRESHOLD ? "queued" : "recommended";

    // Persist the recommendation + rationale + confidence on the need (the
    // explainability audit trail; Lane 3 renders it). Recommendation only —
    // we do NOT change need.status; a human confirms.
    if (needId) {
      const sb = getSupabaseAdmin();
      await sb
        .from("need")
        .update({
          triage_status: status,
          triage_recommendation: options,
          triage_rationale: result.rationale,
          triage_confidence: confidence,
        })
        .eq("id", needId);
    }

    return json({
      needId: needId ?? null,
      options,
      rationale: result.rationale,
      confidence,
      status, // "recommended" | "queued" (low confidence → human queue)
      hitl: "Recommendation only — a human co-pilot confirms before routing.",
    });
  } catch (err) {
    return serverError(err);
  }
}

function clamp01(n: number): number {
  if (Number.isNaN(n)) return 0;
  return Math.max(0, Math.min(1, n));
}
