// Icon-first glyphs for need types (low-data, no extra deps). Always paired
// with a localized label + aria-label by the caller (accessibility.md — never
// icon-only, never color-only).

import type { NeedType } from "../../types";

export const NEED_ICON: Record<NeedType, string> = {
  bed: "🛏️",
  food: "🍲",
  hygiene: "🚿",
  medical: "⚕️",
  talk: "💬",
};
