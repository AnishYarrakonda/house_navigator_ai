// Global app config. Lanes import from here; do not hardcode these elsewhere.

/** San Francisco — the map centers here (see .claude/rules/map.md). */
export const SF_CENTER = { lat: 37.7749, lng: -122.4194 } as const;

/** Default map zoom when the app loads (street-ish). */
export const DEFAULT_ZOOM = 12.5;

/** k-anonymity threshold — never render a heatmap cell with fewer than this
 * many signals (see .claude/rules/privacy.md). */
export const K_ANON_MIN = 5;

/** ~250m geofuzzing grid resolution in degrees (see lib/geocell.ts). */
export const GEOCELL_SIZE_DEG = 0.00225;

/** Default need expiry in hours (see .claude/rules/privacy.md). */
export const NEED_EXPIRY_HOURS = 6;
