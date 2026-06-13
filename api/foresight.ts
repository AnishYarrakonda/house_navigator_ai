// Foresight agent — sees the spike before it lands (ai-agents.md §D).
// AUTONOMOUS, aggregate-only.
//
// Watches 311 encampment/homeless-concern reports, the HSH shelter waitlist,
// the NWS forecast, and the app's own anonymized heatmap. When the signals
// align (cold/wet front + waitlist climbing + 311 clustering in a district),
// it posts a pre-positioning alert to coordinators.
//
// Allowed to act UNATTENDED precisely because it only ever touches aggregate,
// public data — never an identifiable person. There is no redaction step here
// because there is no person-derived input to redact.
//
// Scheduled in production (cron / Supabase Edge Function). Here it's an endpoint
// you POST to; the supervisor or a cron can call it.

import { runToolAgent, type ToolSpec } from "./_lib/agent";
import { json, serverError } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase-admin";
import {
  fetch311,
  fetchHeatmapSignal,
  fetchWaitlist,
  fetchWeather,
} from "./_lib/signals";

interface AlertResult {
  should_alert: boolean;
  area: string;
  rationale: string;
  severity: "watch" | "warning";
}

const SYSTEM = `You are Waypoint's Foresight agent. You watch AGGREGATE, public signals — 311 homeless/encampment reports by district, the shelter waitlist size, tonight's weather, and the app's anonymized heatmap — and predict whether a district is about to overflow tonight.

You never see an individual person; you only ever reason over counts and forecasts.

Decide whether to post a coordinator pre-positioning alert. Post one when signals ALIGN: a cold or wet night, a high/rising waitlist, and 311 reports (or active beacons) clustering in a district. Name the single most at-risk district as the area. Write a short, concrete rationale a coordinator can act on (what's happening + a specific suggestion, e.g. "pre-position N overflow mats"). Severity is "warning" when a harsh-weather night coincides with clustering; "watch" when the picture is concerning but milder. If nothing meaningfully aligns, do not alert.`;

const TOOL: ToolSpec = {
  name: "submit_alert",
  description:
    "Decide whether to post a coordinator pre-positioning alert, and if so its area, rationale, and severity.",
  input_schema: {
    type: "object",
    properties: {
      should_alert: { type: "boolean" },
      area: {
        type: "string",
        description: "District / area label (aggregate, never a person).",
      },
      rationale: {
        type: "string",
        description: "Short, concrete, coordinator-actionable rationale.",
      },
      severity: { type: "string", enum: ["watch", "warning"] },
    },
    required: ["should_alert", "area", "rationale", "severity"],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "POST or GET" }, 400);
  }
  try {
    const [threeOneOne, waitlist, weather, heat] = await Promise.all([
      fetch311(),
      fetchWaitlist(),
      fetchWeather(),
      fetchHeatmapSignal(),
    ]);

    const signals = {
      weather_tonight: {
        forecast: weather.tonight,
        low_temp_f: weather.lowTempF,
        harsh: weather.harsh,
        source: weather.source,
      },
      shelter_waitlist: {
        size: waitlist.size,
        note: waitlist.note,
        source: waitlist.source,
      },
      reports_311_by_district: threeOneOne.byDistrict,
      reports_311_window_hours: threeOneOne.windowHours,
      reports_311_source: threeOneOne.source,
      anonymized_heatmap: {
        active_need_beacons: heat.activeNeeds,
        k_anon_hot_cells: heat.hotCells,
        source: heat.source,
      },
    };

    const result = await runToolAgent<AlertResult>({
      system: SYSTEM,
      user:
        "Here are tonight's aggregate signals. Decide whether to post a " +
        "pre-positioning alert.\n\n" +
        JSON.stringify(signals, null, 2),
      tool: TOOL,
    });

    let alert = null;
    if (result.should_alert) {
      const sb = getSupabaseAdmin();
      const { data, error } = await sb
        .from("foresight_alert")
        .insert({
          area: result.area,
          rationale: result.rationale,
          severity: result.severity,
        })
        .select("*")
        .single();
      if (error) throw error;
      alert = data;
    }

    return json({
      posted: result.should_alert,
      alert,
      signals, // returned so the demo can show what drove the call
    });
  } catch (err) {
    return serverError(err);
  }
}
