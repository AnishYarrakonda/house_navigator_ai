// ORS turn-by-turn maneuver type → Material Symbols glyph. ORS instruction
// `type` is an integer enum; we pair the icon with the text instruction (never
// icon-alone — accessibility.md). Reused by NavigationView.

/** ORS maneuver type (0–13) → Material Symbols icon name. */
const MANEUVER_ICON: Record<number, string> = {
  0: "turn_left", // Left
  1: "turn_right", // Right
  2: "turn_sharp_left", // Sharp left
  3: "turn_sharp_right", // Sharp right
  4: "turn_slight_left", // Slight left
  5: "turn_slight_right", // Slight right
  6: "straight", // Straight
  7: "roundabout_right", // Enter roundabout
  8: "roundabout_right", // Exit roundabout
  9: "u_turn_left", // U-turn
  10: "place", // Goal / arrive
  11: "navigation", // Depart
  12: "turn_slight_left", // Keep left
  13: "turn_slight_right", // Keep right
};

export function maneuverIcon(type: number): string {
  return MANEUVER_ICON[type] ?? "straight";
}
