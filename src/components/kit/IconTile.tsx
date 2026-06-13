// IconTile — a large icon-first selection tile (glyph + localized word) for the
// crisis need picker. ≥112px tall so the whole tile is one generous tap target;
// the glyph is decorative and the word carries meaning (icon + label, never
// icon alone). WCAG AA focus ring + contrast baked in.

import type { ReactNode } from "react";

interface IconTileProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
}

export default function IconTile({ icon, label, onClick }: IconTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={
        "flex min-h-[112px] flex-col items-center justify-center gap-2 rounded-2xl " +
        "bg-white/10 p-4 text-center text-white transition hover:bg-white/15 " +
        "active:bg-white/20 focus-visible:outline-none focus-visible:ring-4 " +
        "focus-visible:ring-waypoint-accent/60"
      }
    >
      <span aria-hidden="true" className="text-waypoint-accent">
        {icon}
      </span>
      <span className="text-base font-semibold leading-tight">{label}</span>
    </button>
  );
}
