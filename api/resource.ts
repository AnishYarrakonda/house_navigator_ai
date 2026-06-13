// Resource agent — keeps the map true (ai-agents.md §A). AUTONOMOUS.
//
// Pulls real SF data (data-sources.md: Pit Stops mr6h-cr3u, public bathrooms /
// water sxtt-wsyn), normalizes messy government records into clean resource_node
// rows, classifies each by need type, and writes a plain-language "what to
// expect" note. It's an AGENT (not a cron job) because it reasons over
// inconsistent schemas + free text — coordinates and field names differ between
// feeds, so a deterministic parser alone can't do it.
//
// Touches ONLY public data → runs unattended, no redaction needed (no person).
// "Scheduled in production"; here it's a run-once seed endpoint.
//
// NOTE: capacity_open is SIMULATED — SF has no public real-time per-bed feed.
// We set it deterministically by type and label it as simulated. We do NOT fake
// a live bed API (data-sources.md).

import { runToolAgent, type ToolSpec } from "./_lib/agent";
import { json, serverError } from "./_lib/http";
import { getSupabaseAdmin } from "./_lib/supabase-admin";
import type { ResourceType } from "../src/types";

const SODA = "https://data.sfgov.org/resource";

interface CleanRecord {
  ref: string; // temp id we use to merge the model's classification back in
  name: string;
  lat: number;
  lng: number;
  hours?: string;
  raw: Record<string, unknown>;
}

interface ClassifiedNode {
  ref: string;
  type: ResourceType;
  what_to_expect: string;
}

const SYSTEM = `You are Waypoint's Resource agent. You normalize messy public records of San Francisco facilities into clean map nodes for people experiencing homelessness.

For each record you receive (id "ref", a name, and raw fields from the source feed), classify it into exactly one need type: "bed", "food", "hygiene", "water", "medical", or "charging-wifi". Pit Stops and public toilets are "hygiene"; drinking-water fountains/refill stations are "water". Then write ONE short, warm, plain-language "what to expect" note (1–2 sentences) someone could read before going — concrete and reassuring, no bureaucratic phrasing.

Return one entry per ref. Do not invent facilities; only classify the records given.`;

const TOOL: ToolSpec = {
  name: "submit_nodes",
  description: "Return one classification + 'what to expect' note per input ref.",
  input_schema: {
    type: "object",
    properties: {
      nodes: {
        type: "array",
        items: {
          type: "object",
          properties: {
            ref: { type: "string" },
            type: {
              type: "string",
              enum: ["bed", "food", "hygiene", "water", "medical", "charging-wifi"],
            },
            what_to_expect: { type: "string" },
          },
          required: ["ref", "type", "what_to_expect"],
        },
      },
    },
    required: ["nodes"],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST" && req.method !== "GET") {
    return json({ error: "POST or GET" }, 400);
  }
  try {
    const pitstops = await fetchFeed(`${SODA}/mr6h-cr3u.json?$limit=12`);
    const bathrooms = await fetchFeed(`${SODA}/sxtt-wsyn.json?$limit=12`);

    const clean: CleanRecord[] = [];
    let i = 0;
    for (const row of [...pitstops, ...bathrooms]) {
      const ll = extractLatLng(row);
      const name = extractName(row);
      if (!ll || !name) continue;
      clean.push({
        ref: `r${i++}`,
        name,
        lat: ll.lat,
        lng: ll.lng,
        hours: extractHours(row),
        raw: row,
      });
    }

    if (clean.length === 0) {
      return json({
        upserted: 0,
        note: "No usable records parsed from the live feeds (offline?). The seed (supabase/seed.sql) already provides the demo nodes.",
      });
    }

    // The reasoning step: classify + write notes over the messy records.
    const { nodes: classified } = await runToolAgent<{ nodes: ClassifiedNode[] }>({
      system: SYSTEM,
      user:
        "Classify these records and write a 'what to expect' note for each.\n\n" +
        JSON.stringify(
          clean.map((c) => ({ ref: c.ref, name: c.name, raw: c.raw })),
          null,
          2,
        ),
      tool: TOOL,
      maxTokens: 2500,
    });

    const byRef = new Map(classified.map((c) => [c.ref, c]));
    const rows = clean
      .map((c) => {
        const cls = byRef.get(c.ref);
        if (!cls) return null;
        const cap = simulatedCapacity(cls.type);
        return {
          id: slugId(c.name, c.ref),
          name: c.name,
          type: cls.type,
          lat: c.lat,
          lng: c.lng,
          capacity_total: cap.total,
          capacity_open: cap.open, // SIMULATED
          hours: c.hours ?? null,
          notes: cls.what_to_expect,
        };
      })
      .filter((r): r is NonNullable<typeof r> => r !== null);

    const sb = getSupabaseAdmin();
    const { error } = await sb
      .from("resource_node")
      .upsert(rows, { onConflict: "id" });
    if (error) throw error;

    return json({
      upserted: rows.length,
      note: "capacity_open is SIMULATED (no public per-bed feed).",
      nodes: rows,
    });
  } catch (err) {
    return serverError(err);
  }
}

async function fetchFeed(url: string): Promise<Array<Record<string, unknown>>> {
  try {
    const res = await fetch(url);
    if (!res.ok) return [];
    return (await res.json()) as Array<Record<string, unknown>>;
  } catch {
    return [];
  }
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string" && v.trim() !== "") {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

/** Coordinates land in different fields across DataSF feeds — try the common ones. */
function extractLatLng(row: Record<string, unknown>): { lat: number; lng: number } | null {
  const lat = toNum(row.latitude ?? row.lat ?? row.y);
  const lng = toNum(row.longitude ?? row.long ?? row.lon ?? row.lng ?? row.x);
  if (lat !== null && lng !== null) return { lat, lng };

  for (const key of ["point", "the_geom", "location", "shape"]) {
    const g = row[key];
    if (g && typeof g === "object") {
      const coords = (g as { coordinates?: unknown }).coordinates;
      if (Array.isArray(coords) && coords.length >= 2) {
        const lo = toNum(coords[0]); // GeoJSON is [lng, lat]
        const la = toNum(coords[1]);
        if (la !== null && lo !== null) return { lat: la, lng: lo };
      }
    }
  }
  return null;
}

function extractName(row: Record<string, unknown>): string | null {
  for (const key of ["name", "facility_name", "facility", "location_name", "address", "cnn"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return null;
}

function extractHours(row: Record<string, unknown>): string | undefined {
  for (const key of ["hours", "hours_of_operation", "schedule", "open_hours"]) {
    const v = row[key];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return undefined;
}

/** capacity_open is simulated for the demo — set deterministically by type. */
function simulatedCapacity(type: ResourceType): { total: number; open: number } {
  switch (type) {
    case "bed":
      return { total: 200, open: 8 };
    case "food":
      return { total: 300, open: 160 };
    case "hygiene":
      return { total: 4, open: 2 };
    case "water":
      return { total: 999, open: 999 };
    case "medical":
      return { total: 60, open: 18 };
    case "charging-wifi":
      return { total: 100, open: 50 };
  }
}

function slugId(name: string, ref: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return `node-${slug || "site"}-${ref}`;
}
