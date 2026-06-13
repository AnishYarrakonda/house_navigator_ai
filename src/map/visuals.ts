// Visual encodings for the map: capacity level (green→amber→red, paired with
// shape — never color alone, see accessibility.md) and a per-type glyph so the
// node category reads at a glance. Pure functions, no MapLibre dependency.

import type { ResourceType } from "../types";

export type CapacityLevel = "open" | "limited" | "full";

/**
 * Derive a capacity level from open/total. `open` and `limited` both still have
 * space; `full` means none. The UI pairs this with a label + border shape.
 */
export function capacityLevel(open: number, total: number): CapacityLevel {
  if (open <= 0 || total <= 0) return "full";
  const ratio = open / total;
  if (ratio >= 0.34) return "open";
  return "limited";
}

/** Emoji glyph per node type — shape carries the type independent of color. */
export const TYPE_GLYPH: Record<ResourceType, string> = {
  bed: "🛏️",
  food: "🍲",
  hygiene: "🚿",
  water: "🚰",
  medical: "✚",
  "charging-wifi": "🔌",
};

/** i18n key fragment + English fallback for a node type (Lane 2 owns the dict). */
export const TYPE_LABEL: Record<ResourceType, string> = {
  bed: "shelter",
  food: "food",
  hygiene: "hygiene",
  water: "water",
  medical: "clinic",
  "charging-wifi": "charging & wifi",
};

/** English fallback for a capacity level (used in aria-labels). */
export const LEVEL_LABEL: Record<CapacityLevel, string> = {
  open: "space available",
  limited: "limited space",
  full: "full",
};

// --- Route colors (the glowing path home) ---------------------------------- //
export const ROUTE = {
  /** Bright core of a completed segment. */
  doneCore: "#ffd9a0",
  /** Warm under-glow behind the core. */
  doneGlow: "#f4a259",
  /** Dim dotted upcoming segment. */
  todo: "#c98a4a",
} as const;
