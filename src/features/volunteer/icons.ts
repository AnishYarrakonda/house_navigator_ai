// Need-type glyphs (inbound cards, thread). Material Symbols ligature names,
// rendered via the shared <Icon> kit component — monochrome and consistent with
// the rest of the app, never decorative emoji. Always paired with a label.

import type { NeedType } from "../../types";

export const NEED_ICON: Record<NeedType, string> = {
  bed: "night_shelter",
  food: "restaurant",
  hygiene: "shower",
  medical: "medical_services",
  talk: "forum",
};
