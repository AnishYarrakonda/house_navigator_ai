// BigButton — the crisis side's full-width primary action affordance (the
// "I need help" CTA exception in the design system: full-width, large, radius
// 14, cobalt with an inset highlight + glow). WCAG AA defaults baked in: ≥56px
// tap height, visible focus ring, strong contrast. Icon is decorative
// (aria-hidden); the text label carries meaning.

import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary";

interface BigButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  /** Decorative glyph rendered before the label. */
  icon?: ReactNode;
  variant?: Variant;
}

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-gradient-to-b from-wp-acc to-[#2358d2] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_8px_28px_rgba(47,109,246,0.32)] " +
    "hover:from-wp-acc2 hover:to-wp-acc active:from-wp-accd active:to-[#1743a6] hover:scale-[1.015] active:scale-[0.985] active:translate-y-0",
  secondary:
    "bg-wp-surf3 text-wp-tx border border-wp-line2 hover:bg-wp-surf4 active:translate-y-px",
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
        "flex min-h-[56px] w-full items-center justify-center gap-3 rounded-[14px] px-6 py-4 " +
        "text-lg font-bold transition focus-visible:outline-none " +
        "focus-visible:ring-4 focus-visible:ring-wp-acc/60 " +
        "disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none " +
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
