// Routing proxy — road-snapped walking routes from OpenRouteService, used by the
// map's glowing "path home" (src/lib/routing.ts calls this; it falls back to a
// curved line if this is unavailable). Keeps ORS_API_KEY server-side.
//
// POST { from: {lat,lng}, to: {lat,lng} }
//   → { coordinates: [lng,lat][], distanceMeters, durationSeconds }
//
// Privacy: the caller passes the person's FUZZED cell center as `from`, never a
// precise point (privacy.md). We only proxy two coordinates to ORS.

import { badRequest, json, readJson, serverError } from "./_lib/http";

interface RouteBody {
  from?: { lat: number; lng: number };
  to?: { lat: number; lng: number };
}

interface OrsResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number][] };
    properties?: { summary?: { distance?: number; duration?: number } };
  }>;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const { from, to } = await readJson<RouteBody>(req);
    if (!from || !to) return badRequest("Provide { from, to }.");

    const key = process.env.ORS_API_KEY;
    if (!key) {
      // No key configured — tell the client to use its curved fallback.
      return json({ error: "ORS_API_KEY not set" }, 503);
    }

    const res = await fetch(
      "https://api.openrouteservice.org/v2/directions/foot-walking/geojson",
      {
        method: "POST",
        headers: {
          Authorization: key,
          "content-type": "application/json",
        },
        body: JSON.stringify({
          coordinates: [
            [from.lng, from.lat],
            [to.lng, to.lat],
          ],
        }),
      },
    );

    if (!res.ok) {
      return json({ error: `ORS ${res.status}` }, 502);
    }

    const data = (await res.json()) as OrsResponse;
    const feature = data.features?.[0];
    const coordinates = feature?.geometry?.coordinates ?? [];
    if (coordinates.length === 0) {
      return json({ error: "no route geometry" }, 502);
    }
    const summary = feature?.properties?.summary ?? {};

    return json({
      coordinates,
      distanceMeters: summary.distance ?? 0,
      durationSeconds: summary.duration ?? 0,
    });
  } catch (err) {
    return serverError(err);
  }
}
