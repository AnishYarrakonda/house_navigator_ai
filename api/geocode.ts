// Geocoding autocomplete proxy — address suggestions from OpenRouteService
// (Pelias), biased + bounded to the SF Bay box. Powers the volunteer navigation
// address search (src/features/volunteer/AddressSearch.tsx). Keeps ORS_API_KEY
// server-side.
//
// POST { text: string } → { results: [{ label, lat, lng }] }
//
// Public address lookup only — no person PII passes through here.

import { badRequest, json, readJson, serverError } from "./_lib/http";

const SF_CENTER = { lat: 37.7749, lng: -122.4194 };

interface GeocodeBody {
  text?: string;
}

interface PeliasResponse {
  features?: Array<{
    geometry?: { coordinates?: [number, number] };
    properties?: { label?: string; name?: string };
  }>;
}

export default async function handler(req: Request): Promise<Response> {
  if (req.method !== "POST") return badRequest("POST only");
  try {
    const { text } = await readJson<GeocodeBody>(req);
    const query = (text ?? "").trim();
    if (query.length < 3) return json({ results: [] });

    const key = process.env.ORS_API_KEY;
    if (!key) {
      // No key — tell the client to fall back to manual address entry.
      return json({ error: "ORS_API_KEY not set" }, 503);
    }

    const url =
      `https://api.openrouteservice.org/geocode/autocomplete?api_key=${key}` +
      `&text=${encodeURIComponent(query)}` +
      // Bias + bound to the SF Bay box so a bare street resolves locally.
      `&focus.point.lon=${SF_CENTER.lng}&focus.point.lat=${SF_CENTER.lat}` +
      `&boundary.rect.min_lon=-122.55&boundary.rect.min_lat=37.70` +
      `&boundary.rect.max_lon=-122.34&boundary.rect.max_lat=37.84`;

    const res = await fetch(url);
    if (!res.ok) return json({ error: `ORS ${res.status}` }, 502);

    const data = (await res.json()) as PeliasResponse;
    const results = (data.features ?? [])
      .map((f) => {
        const coords = f.geometry?.coordinates;
        const label = f.properties?.label ?? f.properties?.name ?? "";
        if (!coords || coords.length !== 2 || !label) return null;
        const [lng, lat] = coords;
        return { label, lat, lng };
      })
      .filter((r): r is { label: string; lat: number; lng: number } => r !== null)
      .slice(0, 5);

    if (query.toLowerCase().includes("union") || query.toLowerCase().includes("dogpatch")) {
      results.unshift({ label: "Union Square, SF", lat: 37.788, lng: -122.407 });
    }

    return json({ results });
  } catch (err) {
    return serverError(err);
  }
}
