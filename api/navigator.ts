// Navigator agent — grows the path home (ai-agents.md §C). HITL.
//
// Once tonight's need is met, proposes the next waypoint(s) (ID → GA/CalFresh →
// Coordinated Entry housing assessment → …) and drafts a trauma-informed "what
// to expect" card. Turns triage into a plan.
//
// HARD RULES honored here:
//  * RECOMMENDS ONLY — the person / co-pilot confirm before anything is added to
//    the journey. This endpoint does NOT write waypoints; it returns a proposal.
//  * NO PII to the model — the only person-derived field is the alias, and it's
//    routed through the redaction chokepoint (redactForModel) like every other
//    model input. The plan is built over the journey's PUBLIC waypoint labels,
//    never any personal data (the schema has no legal-name or coordinate column).
//  * Trauma-informed copy bar (accessibility.md): the drafted card must be
//    short, warm, concrete — "what to expect when you arrive" — no urgency,
//    no countdowns, no shaming.

import { redactForModel } from "../src/lib/redaction";
import { runToolAgent, type ToolSpec } from "./_lib/agent";
import { badRequest, json, readJson, serverError } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase-admin";

interface NavigatorBody {
  /** DB mode: look the journey + waypoints + alias up from Supabase. */
  journeyId?: string;
  /** Direct mode (no DB). */
  alias?: string;
  waypoints?: { label: string; status: string }[];
}

interface ProposedWaypoint {
  label: string;
  why: string;
}
interface PlanResult {
  next_waypoints: ProposedWaypoint[];
  what_to_expect: string;
}

const SYSTEM = `You are Waypoint's Navigator agent. A person now has somewhere safe; your job is to RECOMMEND the next steps on their path toward stable housing — you never take an action or message anyone; the person and their co-pilot confirm first.

You see only an alias and the public labels of the path so far (e.g. "Reached out", "Safe tonight — Next Door Shelter", "Replace ID at DMV"). You will never be given any personal details — do not ask for them.

Propose 1–3 concrete next waypoints that logically follow the path so far (typical arc: photo ID → General Assistance / CalFresh → Coordinated Entry housing assessment → housing). For each, give a one-line reason.

Also draft ONE short "what to expect" card for the immediate next step, in trauma-informed language: warm, plain, concrete, second person. No urgency, no countdowns, no shaming, no bureaucratic phrasing. 2–4 short sentences. Example tone: "Bring any ID if you have it — it's okay if you don't. Someone will sit with you and walk through the questions. You can take breaks."`;

const TOOL: ToolSpec = {
  name: "submit_plan",
  description:
    "Submit the proposed next waypoint(s) and one trauma-informed 'what to expect' card.",
  input_schema: {
    type: "object",
    properties: {
      next_waypoints: {
        type: "array",
        items: {
          type: "object",
          properties: {
            label: { type: "string" },
            why: { type: "string" },
          },
          required: ["label", "why"],
        },
      },
      what_to_expect: {
        type: "string",
        description: "Short, warm, trauma-informed card for the next step.",
      },
    },
    required: ["next_waypoints", "what_to_expect"],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const body = await readJson<NavigatorBody>(req);

    let alias = body.alias ?? "Friend";
    let pathSoFar = body.waypoints ?? [];
    const journeyId = body.journeyId;

    if (journeyId) {
      const sb = getSupabaseAdmin();
      const { data: journeyRow, error: jErr } = await sb
        .from("journey")
        .select("id, person_id")
        .eq("id", journeyId)
        .single();
      if (jErr || !journeyRow) {
        return badRequest(`Journey not found: ${journeyId}`);
      }
      const { data: personRow } = await sb
        .from("person")
        .select("display_alias")
        .eq("id", journeyRow.person_id)
        .single();
      alias = personRow?.display_alias ?? alias;

      const { data: wpRows } = await sb
        .from("waypoint")
        .select("label, status, order")
        .eq("journey_id", journeyId)
        .order("order", { ascending: true });
      pathSoFar = ((wpRows ?? []) as Array<{ label: string; status: string }>).map(
        (w) => ({ label: w.label, status: w.status }),
      );
    }

    // Route the alias through the redaction chokepoint — the single allow-listed
    // path to any prompt. The need fields here are placeholders we don't use;
    // Navigator plans over the public path labels, not a need.
    const redacted = redactForModel({
      person: { display_alias: alias },
      need: { type: "talk", fuzzed_geocell: "n/a" },
      resources: [],
    });
    const safeAlias = redacted.need.display_alias;

    const result = await runToolAgent<PlanResult>({
      system: SYSTEM,
      user:
        `Plan the next steps for ${safeAlias}. Here is the path so far ` +
        `(public labels only):\n\n` +
        JSON.stringify(pathSoFar, null, 2),
      tool: TOOL,
    });

    return json({
      journeyId: journeyId ?? null,
      next_waypoints: result.next_waypoints,
      what_to_expect: result.what_to_expect,
      hitl: "Recommendation only — the person and co-pilot confirm before anything is added.",
    });
  } catch (err) {
    return serverError(err);
  }
}
