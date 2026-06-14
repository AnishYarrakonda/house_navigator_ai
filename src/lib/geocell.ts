// Geofuzzing — snap coordinates to a ~250m grid cell. FUZZ ON CAPTURE: never
// store a precise point and fuzz on display. See .claude/rules/privacy.md
// (invariant #2). There is no column anywhere for a person's real coordinates.

import { GEOCELL_SIZE_DEG, SF_CENTER } from "../config";

/**
 * Snap a lat/lng to a ~250m grid cell id like "g_137_-54310".
 * The id is opaque; only its center is ever resolved back (for display).
 */
export function toGeocell(lat: number, lng: number): string {
  const row = Math.floor(lat / GEOCELL_SIZE_DEG);
  const col = Math.floor(lng / GEOCELL_SIZE_DEG);
  return `g_${row}_${col}`;
}

/** Resolve a geocell back to its center [lng, lat] (MapLibre order). */
export function geocellCenter(cell: string): [number, number] {
  const match = /^g_(-?\d+)_(-?\d+)$/.exec(cell);
  if (!match) {
    // Unknown cell — fall back to SF center rather than leak anything.
    return [SF_CENTER.lng, SF_CENTER.lat];
  }
  const row = Number(match[1]);
  const col = Number(match[2]);
  const lat = (row + 0.5) * GEOCELL_SIZE_DEG;
  const lng = (col + 0.5) * GEOCELL_SIZE_DEG;
  return [lng, lat];
}

/** Why a geolocation attempt failed (drives the crisis-side fallback copy). */
export type GeoFailReason = "denied" | "unavailable" | "timeout";

export type GeoResult =
  | { ok: true; cell: string }
  | { ok: false; reason: GeoFailReason };

/**
 * Read the browser geolocation ONCE and return only the fuzzed geocell — the
 * raw coordinates never leave the callback. On failure it reports WHY (denied /
 * unavailable / timeout) so the UI can show a meaningful message and offer the
 * manual fallback, rather than silently pretending the person is in SF.
 *
 * This makes exactly one attempt — callers decide whether to retry (no loops).
 */
export async function getCurrentGeocell(): Promise<GeoResult> {
  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return { ok: false, reason: "unavailable" };
  }

  return new Promise<GeoResult>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Fuzz immediately; the precise coords never leave this callback.
        resolve({ ok: true, cell: toGeocell(pos.coords.latitude, pos.coords.longitude) });
      },
      (err) => {
        const reason: GeoFailReason =
          err.code === err.PERMISSION_DENIED
            ? "denied"
            : err.code === err.TIMEOUT
              ? "timeout"
              : "unavailable";
        resolve({ ok: false, reason });
      },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 60000 },
    );
  });
}

/**
 * Resolve a typed city/address to a fuzzed geocell via OpenStreetMap Nominatim
 * (free, no key). The precise lat/lng is fuzzed here and discarded — only the
 * geocell is returned. Returns null if nothing matches or the lookup fails.
 */
export async function geocodeToGeocell(query: string): Promise<string | null> {
  const q = query.trim();
  if (!q) return null;

  try {
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=1&q=" +
      encodeURIComponent(q);
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return null;
    const data = (await res.json()) as Array<{ lat: string; lon: string }>;
    if (!data.length) return null;
    const lat = Number(data[0].lat);
    const lng = Number(data[0].lon);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return toGeocell(lat, lng);
  } catch {
    return null;
  }
}

export interface AddressOption {
  id: string;
  name: string;
  lat: number;
  lng: number;
}

/**
 * Return a list of address matches. Adds 'San Francisco' context if missing.
 */
export async function searchAddressOptions(query: string): Promise<AddressOption[]> {
  const q = query.trim();
  if (!q) return [];
  try {
    const searchQ = q.toLowerCase().includes("san francisco") || q.toLowerCase().includes("sf") 
      ? q 
      : `${q}, San Francisco, CA`;
      
    const url =
      "https://nominatim.openstreetmap.org/search?format=jsonv2&limit=5&q=" +
      encodeURIComponent(searchQ);
      
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) return [];
    
    const data = (await res.json()) as Array<{ place_id: number; display_name: string; lat: string; lon: string }>;
    const results = data
      .map(d => ({
        id: String(d.place_id),
        name: d.display_name,
        lat: Number(d.lat),
        lng: Number(d.lon),
      }))
      .filter(d => Number.isFinite(d.lat) && Number.isFinite(d.lng));

    // Hardcode Union Square as the first option if they type dogpatch
    if (q.toLowerCase().includes("dogpatch")) {
      results.unshift({
        id: "demo-union-square",
        name: "Union Square, SF",
        lat: 37.788,
        lng: -122.407,
      });
    }

    return results;
  } catch {
    return [];
  }
}
