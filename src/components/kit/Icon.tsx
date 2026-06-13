// Icon — a thin wrapper over Material Symbols Rounded (loaded in index.html).
// The glyph is referenced by its ligature name (e.g. "night_shelter"). Icons
// are decorative by default (aria-hidden); when an icon carries meaning on its
// own, pass a `label` and it becomes an accessible image.

import type { CSSProperties } from "react";

interface IconProps {
  /** Material Symbols ligature name, e.g. "waving_hand", "restaurant". */
  name: string;
  /** Pixel size of the glyph. */
  size?: number;
  /** Filled (FILL 1) vs outlined (FILL 0). */
  fill?: boolean;
  className?: string;
  /** If set, the icon is exposed to assistive tech with this label. */
  label?: string;
  style?: CSSProperties;
}

export default function Icon({
  name,
  size = 20,
  fill = false,
  className = "",
  label,
  style,
}: IconProps) {
  return (
    <span
      className={`wp-icon${fill ? " wp-icon--fill" : ""} ${className}`}
      style={{ fontSize: size, ...style }}
      aria-hidden={label ? undefined : true}
      role={label ? "img" : undefined}
      aria-label={label}
    >
      {name}
    </span>
  );
}
