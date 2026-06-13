// Listing agent — the volunteer-side "post a listing" parser.
//
// A volunteer types a plain-English description of housing / resources they can
// offer ("2 spare beds in my place near the Mission, open evenings, dog-friendly").
// This endpoint turns that free text into a structured ResourceNode via Claude
// tool use, geocodes the address to a point, and returns the listing ready to be
// saved through the data layer.
//
// Public, volunteer-supplied data only — no person PII passes through here, so
// no redaction layer is required (cf. api/triage.ts, which handles person words).

import type { ResourceType } from "../src/types";
import { runToolAgent, type ToolSpec } from "./_lib/agent";
import { badRequest, json, readJson, serverError } from "./_lib/http";

// SF center — fallback when no address geocodes (data-sources.md: center on SF).
const SF_CENTER = { lat: 37.7749, lng: -122.4194 };

const RESOURCE_TYPES: ResourceType[] = [
  "bed",
  "food",
  "hygiene",
  "water",
  "medical",
  "charging-wifi",
];

interface ListingBody {
  text?: string;
}

interface ParsedListing {
  name: string;
  type: ResourceType;
  capacity_total: number;
  capacity_open: number;
  hours?: string;
  notes?: string;
  address?: string;
}

const SYSTEM = `You are Waypoint's Listing agent. A volunteer or organization describes, in plain English, housing or resources they can offer people experiencing homelessness in San Francisco. Turn their description into one structured resource listing.

Classify the listing into exactly one type:
- "bed" — shelter beds, a spare room, a place to sleep
- "food" — meals, groceries, a pantry
- "hygiene" — showers, restrooms, laundry
- "water" — drinking water
- "medical" — clinic, first aid, medical care
- "charging-wifi" — phone charging, wifi, a place to sit

Infer a short, friendly name if none is given (e.g. "Spare room in the Mission"). Infer capacity_total from the text (how many people can be helped at once); default to 1 if unstated. Set capacity_open equal to capacity_total unless the text says some are already taken. Capture hours if mentioned. Put any useful detail (pets ok, accessibility, what to expect) into notes — keep it short, warm, concrete. Extract a street address or neighborhood into address if present.`;

const TOOL: ToolSpec = {
  name: "submit_listing",
  description:
    "Submit the structured resource listing parsed from the volunteer's description.",
  input_schema: {
    type: "object",
    properties: {
      name: { type: "string", description: "Short friendly listing name." },
      type: {
        type: "string",
        enum: RESOURCE_TYPES,
        description: "One of the allowed resource types.",
      },
      capacity_total: {
        type: "number",
        description: "How many people can be helped at once (>= 1).",
      },
      capacity_open: {
        type: "number",
        description: "How many spots are currently open (<= capacity_total).",
      },
      hours: { type: "string", description: "Hours, if mentioned." },
      notes: {
        type: "string",
        description: "Short, warm what-to-expect detail.",
      },
      address: {
        type: "string",
        description: "Street address or neighborhood, if present.",
      },
    },
    required: ["name", "type", "capacity_total", "capacity_open"],
  },
};

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const body = await readJson<ListingBody>(req);
    const text = (body.text ?? "").trim();
    if (!text) return badRequest("Provide { text } describing the listing.");

    const parsed = await runToolAgent<ParsedListing>({
      system: SYSTEM,
      user:
        "Parse this volunteer's listing description into a structured listing:\n\n" +
        text,
      tool: TOOL,
    });

    // Sanitize the model output into sane, well-typed values.
    const type: ResourceType = RESOURCE_TYPES.includes(parsed.type)
      ? parsed.type
      : "bed";
    const capacity_total = clampInt(parsed.capacity_total, 1, 1);
    const capacity_open = clampInt(parsed.capacity_open, capacity_total, 0, capacity_total);
    const name = (parsed.name ?? "").trim() || "Volunteer listing";
    const address = parsed.address?.trim() || undefined;

    const { lat, lng } = await geocode(address);

    return json({
      name,
      type,
      capacity_total,
      capacity_open,
      hours: parsed.hours?.trim() || undefined,
      notes: parsed.notes?.trim() || undefined,
      address,
      lat,
      lng,
    });
  } catch (err) {
    return serverError(err);
  }
}

/**
 * Geocode an address to {lat,lng}. Uses OpenRouteService biased to SF if
 * ORS_API_KEY is set; otherwise (and on any failure) falls back to SF center
 * plus a small random offset so listings don't all stack on one pin.
 */
async function geocode(
  address: string | undefined,
): Promise<{ lat: number; lng: number }> {
  const key = process.env.ORS_API_KEY;
  if (address && key) {
    try {
      const url =
        `https://api.openrouteservice.org/geocode/search?api_key=${key}` +
        `&text=${encodeURIComponent(address)}` +
        // Bias + bound to the SF Bay box so a bare neighborhood resolves locally.
        `&focus.point.lon=${SF_CENTER.lng}&focus.point.lat=${SF_CENTER.lat}` +
        `&boundary.rect.min_lon=-122.55&boundary.rect.min_lat=37.70` +
        `&boundary.rect.max_lon=-122.34&boundary.rect.max_lat=37.84` +
        `&size=1`;
      const res = await fetch(url);
      if (res.ok) {
        const data = (await res.json()) as {
          features?: Array<{ geometry?: { coordinates?: [number, number] } }>;
        };
        const coords = data.features?.[0]?.geometry?.coordinates;
        if (coords && coords.length === 2) {
          const [lng, lat] = coords;
          return { lat, lng };
        }
      }
    } catch {
      // fall through to SF-center fallback
    }
  }
  return sfCenterJitter();
}

/** SF center plus a small (~few hundred meters) random offset. */
function sfCenterJitter(): { lat: number; lng: number } {
  const jitter = () => (Math.random() - 0.5) * 0.02;
  return { lat: SF_CENTER.lat + jitter(), lng: SF_CENTER.lng + jitter() };
}

function clampInt(n: unknown, fallback: number, min: number, max = Infinity): number {
  const v = typeof n === "number" && Number.isFinite(n) ? Math.round(n) : fallback;
  return Math.max(min, Math.min(max, v));
}
