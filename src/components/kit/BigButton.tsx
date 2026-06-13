// BigButton — the crisis side's primary action affordance. WCAG AA defaults
// baked in: ≥56px tap height, visible focus ring, strong contrast. Icon is
// decorative (aria-hidden); the text label carries meaning. Reused everywhere
// on the crisis side and importable by other lanes.

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Decorative glyph rendered before the label. */
  icon?: ReactNode;
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-waypoint-accent text-waypoint-bg hover:brightness-105 active:brightness-95",
  secondary: "bg-white/10 text-white hover:bg-white/15 active:bg-white/20",
};

export default function BigButton({
  icon,
  variant = "primary",
  type = "button",
  className = "",
  children,
  ...rest
}: BigButtonProps) {
  return (
    <button
      type={type}
      className={
        "flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl px-6 py-4 " +
        "text-lg font-semibold transition focus-visible:outline-none " +
        "focus-visible:ring-4 focus-visible:ring-waypoint-accent/60 " +
        "disabled:cursor-not-allowed disabled:opacity-50 " +
        VARIANTS[variant] +
        " " +
        className
      }
      {...rest}
    >
      {icon ? (
        <span aria-hidden="true" className="shrink-0">
          {icon}
        </span>
      ) : null}
      <span>{children}</span>
    </button>
  );
}
