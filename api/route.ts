// Routing proxy — road-snapped walking routes from OpenRouteService, used by the
// map's glowing "path home" (src/lib/routing.ts calls this; it falls back to a
// curved line if this is unavailable). Keeps ORS_API_KEY server-side.
//
// POST { from: {lat,lng}, to: {lat,lng} }                 (two-point route)
//  or  POST { coordinates: [lng,lat][] }                  (multi-stop journey)
//   → { coordinates: [lng,lat][], distanceMeters, durationSeconds }
//
// Opt-in (volunteer turn-by-turn navigation, src/features/volunteer):
//  POST { from, to, instructions: true, alternatives?: true, language?: "en" }
//   → { routes: [{ coordinates, distanceMeters, durationSeconds, steps:[...] }] }
//  `alternatives` asks ORS for up to 3 distinct routes (only valid for a two-point
//  from/to). `instructions` includes turn-by-turn steps. The legacy single-shape
//  response is unchanged when neither flag is set, so existing callers (the crisis
//  picker, seeded journeys) keep working.
//
// Privacy: the caller passes the person's FUZZED cell center as the origin, never
// a precise point on the crisis side (privacy.md). The volunteer side passes its
// own/public points on purpose (it is not a vulnerable person).

import { badRequest, json, readJson, serverError } from "./_lib/http";

type LngLat = [number, number];

interface RouteBody {
  from?: { lat: number; lng: number };
  to?: { lat: number; lng: number };
  // Ordered [lng,lat] stops for a multi-waypoint route (≥2).
  coordinates?: LngLat[];
  // Turn-by-turn steps + multiple options (volunteer navigation).
  instructions?: boolean;
  alternatives?: boolean;
  language?: string;
}

interface OrsStep {
  distance?: number;
  duration?: number;
  type?: number;
  instruction?: string;
  name?: string;
  way_points?: [number, number];
}

interface OrsFeature {
  geometry?: { coordinates?: LngLat[] };
  properties?: {
    summary?: { distance?: number; duration?: number };
    segments?: Array<{ steps?: OrsStep[] }>;
  };
}

interface OrsResponse {
  features?: OrsFeature[];
}

/** Normalize one ORS feature → our route shape (with flattened steps). */
function toRoute(feature: OrsFeature) {
  const coordinates = feature.geometry?.coordinates ?? [];
  const summary = feature.properties?.summary ?? {};
  const steps = (feature.properties?.segments ?? []).flatMap((seg) =>
    (seg.steps ?? []).map((s) => ({
      instruction: s.instruction ?? "",
      distanceMeters: s.distance ?? 0,
      durationSeconds: s.duration ?? 0,
      type: s.type ?? 0,
      name: s.name ?? "",
      wayPoints: s.way_points ?? [0, 0],
    })),
  );
  return {
    coordinates,
    distanceMeters: summary.distance ?? 0,
    durationSeconds: summary.duration ?? 0,
    steps,
  };
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const { from, to, coordinates, instructions, alternatives, language } =
      await readJson<RouteBody>(req);

    // Accept either an explicit multi-stop `coordinates` array or a {from,to}
    // pair (normalized to the same [lng,lat][] ORS expects).
    const stops: LngLat[] =
      coordinates && coordinates.length >= 2
        ? coordinates
        : from && to
          ? [
              [from.lng, from.lat],
              [to.lng, to.lat],
            ]
          : [];
    if (stops.length < 2) {
      return badRequest("Provide { from, to } or { coordinates: [...] } (≥2).");
    }

    const key = process.env.ORS_API_KEY;
    if (!key) {
      // No key configured — tell the client to use its curved fallback.
      return json({ error: "ORS_API_KEY not set" }, 503);
    }

    const wantSteps = instructions === true || alternatives === true;
    // ORS only allows alternative_routes on a two-point request.
    const wantAlternatives = alternatives === true && stops.length === 2;

    const body: Record<string, unknown> = {
      coordinates: stops,
      instructions: wantSteps,
    };
    if (wantSteps && language) body.language = language;
    if (wantAlternatives) {
      body.alternative_routes = {
        target_count: 3,
        weight_factor: 1.6,
        share_factor: 0.6,
      };
    }

    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          Authorization: key,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      },
    );

    if (!res.ok) {
      return json({ error: `ORS ${res.status}` }, 502);
    }

    const data = (await res.json()) as OrsResponse;
    const features = data.features ?? [];
    if (features.length === 0 || (features[0].geometry?.coordinates ?? []).length === 0) {
      return json({ error: "no route geometry" }, 502);
    }

    // Opt-in multi-route / turn-by-turn response.
    if (wantSteps) {
      return json({ routes: features.map(toRoute) });
    }

    // Legacy single-route shape (back-compat for existing callers).
    const r = toRoute(features[0]);
    return json({
      coordinates: r.coordinates,
      distanceMeters: r.distanceMeters,
      durationSeconds: r.durationSeconds,
    });
  } catch (err) {
    return serverError(err);
  }
}
