// Thin supervisor — routes blackboard events to the right runtime agent and
// lets them hand off (ai-agents.md §Orchestration). Deliberately thin: it's a
// router over specialists + the shared blackboard, NOT a monolith.
//
//   need.open   → Triage   (recommend resource options for the new need)
//   need.close  → Navigator (grow the path home once tonight's need is met)
//                 ↑ this is the observable Triage→Navigator handoff.
//
// WIRING (production): a Postgres trigger turns table changes into events that
// POST here. Sketch (add as a migration once the DB http extension is enabled):
//
//   AFTER INSERT ON need:                 POST /api/supervisor {type:'need.open',  needId:NEW.id}
//   AFTER UPDATE ON need WHEN NEW.status='met':  POST /api/supervisor {type:'need.close', needId:NEW.id}
//
// using supabase's `supabase_functions.http_request` trigger helper (or pg_net).
// For the demo you can also POST here directly. The scheduled agents
// (Resource / Foresight) run on cron / Edge Functions, not through this router.

import triageHandler from "./triage";
import navigatorHandler from "./navigator";
import { badRequest, readJson, serverError } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase-admin";

interface SupervisorEvent {
  type: "need.open" | "need.close" | "need.met";
  needId?: string;
  journeyId?: string;
}

function internalRequest(payload: unknown): Request {
  return new Request("http://internal/supervisor", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(payload),
  });
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const event = await readJson<SupervisorEvent>(req);

    switch (event.type) {
      case "need.open": {
        if (!event.needId) return badRequest("need.open requires needId");
        console.log(`[supervisor] need.open → Triage (need ${event.needId})`);
        return triageHandler(internalRequest({ needId: event.needId }));
      }

      case "need.close":
      case "need.met": {
        // A need closing is the Triage→Navigator handoff: the person now has
        // somewhere safe, so Navigator grows the path home. Resolve the journey
        // from the need's person if only needId was provided.
        let journeyId = event.journeyId;
        if (!journeyId && event.needId) {
          journeyId = await journeyForNeed(event.needId);
        }
        if (!journeyId) {
          return badRequest(
            "need.close requires journeyId (or a needId whose person has a journey)",
          );
        }
        console.log(
          `[supervisor] need.close → Navigator — Triage→Navigator handoff ` +
            `(journey ${journeyId})`,
        );
        return navigatorHandler(internalRequest({ journeyId }));
      }

      default:
        return badRequest(`Unknown event type: ${String(event.type)}`);
    }
  } catch (err) {
    return serverError(err);
  }
}

/** Find the active journey for the person who owns a given need. */
async function journeyForNeed(needId: string): Promise<string | undefined> {
  const sb = getSupabaseAdmin();
  const { data: needRow } = await sb
    .from("need")
    .select("person_id")
    .eq("id", needId)
    .single();
  if (!needRow?.person_id) return undefined;
  const { data: journeyRow } = await sb
    .from("journey")
    .select("id")
    .eq("person_id", needRow.person_id)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return journeyRow?.id;
}
