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

/**
 * Read the browser geolocation and return ONLY the fuzzed geocell — never the
 * raw coordinates. Falls back to a hard-coded SF cell for the demo / when
 * geolocation is denied or unavailable.
 */
export async function getFuzzedLocation(): Promise<string> {
  const fallback = toGeocell(SF_CENTER.lat, SF_CENTER.lng);

  if (typeof navigator === "undefined" || !navigator.geolocation) {
    return fallback;
  }

  return new Promise<string>((resolve) => {
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        // Fuzz immediately; the precise coords never leave this callback.
        resolve(toGeocell(pos.coords.latitude, pos.coords.longitude));
      },
      () => resolve(fallback),
      { enableHighAccuracy: false, timeout: 5000, maximumAge: 60000 },
    );
  });
}
