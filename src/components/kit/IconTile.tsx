// IconTile — a large icon-first selection tile (glyph + localized word) for the
// crisis need picker (per Navigation Map/components/NeedTile.dc.html). ≥96px tall
// so the whole tile is one generous tap target; the glyph is decorative and the
// word carries meaning (icon + label, never icon alone). Selected state pairs a
// cobalt tint with an accent border + text — not color alone. WCAG AA focus ring.

import type { ReactNode } from "react";

interface IconTileProps {
  icon: ReactNode;
  label: string;
  onClick: () => void;
  /** Highlight as the chosen tile. */
  selected?: boolean;
}

export default function IconTile({
  icon,
  label,
  onClick,
  selected = false,
}: IconTileProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={selected}
      className={
        "flex min-h-[96px] flex-col items-center justify-center gap-2 rounded-[14px] " +
        "border p-4 text-center transition focus-visible:outline-none " +
        "focus-visible:ring-4 focus-visible:ring-wp-acc/50 " +
        (selected
          ? "border-[rgba(47,109,246,0.4)] bg-[rgba(47,109,246,0.12)] text-wp-acc2"
          : "border-wp-line bg-wp-surf2 text-wp-txd hover:border-wp-acc hover:bg-wp-surf3 hover:text-wp-tx")
      }
    >
      <span aria-hidden="true" className="leading-none">
        {icon}
      </span>
      <span className="text-xs font-semibold leading-tight">{label}</span>
    </button>
  );
}
