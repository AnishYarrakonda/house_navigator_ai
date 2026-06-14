// Button — the compact action button used throughout the co-pilot / coordinator
// panels (per Navigation Map/components/Button.dc.html). Short-labelled, never
// punishing. Confirmation lives in green; the cobalt primary is reserved for the
// single most-important action. Icon is decorative.
//
// For the crisis side's full-width "I need help" CTA, use BigButton instead.

import type { ButtonHTMLAttributes, ReactNode } from "react";

export type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "confirm"
  | "teal"
  | "text";
export type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  /** Decorative leading glyph. */
  icon?: ReactNode;
}

const VARIANTS: Record<ButtonVariant, string> = {
  primary:
    "bg-gradient-to-b from-wp-acc to-[#2358d2] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.25),0_2px_6px_rgba(0,0,0,0.35)] " +
    "hover:from-wp-acc2 hover:to-wp-acc hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.3),0_4px_12px_rgba(47,109,246,0.4)] " +
    "active:from-wp-accd active:to-[#1743a6] hover:scale-[1.02] active:scale-[0.97] " +
    "disabled:from-wp-surf3 disabled:to-wp-surf3 disabled:text-wp-txf disabled:shadow-none disabled:transform-none",
  secondary:
    "bg-wp-surf3 text-wp-tx border border-wp-line2 hover:bg-wp-surf4 disabled:text-wp-txf",
  ghost:
    "bg-transparent text-wp-txd border border-wp-line hover:text-wp-tx hover:bg-wp-surf3 disabled:text-wp-txf",
  confirm:
    "bg-[rgba(76,195,138,0.14)] text-[#7ad6a6] border border-[rgba(76,195,138,0.32)] hover:bg-[rgba(76,195,138,0.2)] disabled:text-wp-txf disabled:border-wp-line",
  teal: "bg-[rgba(14,149,148,0.14)] text-[#5fd6d2] border border-[rgba(14,149,148,0.34)] hover:bg-[rgba(14,149,148,0.2)]",
  text: "bg-transparent text-wp-acc2 hover:text-white",
};

const SIZES: Record<ButtonSize, string> = {
  sm: "rounded-[7px] px-3 py-[7px] text-xs",
  md: "rounded-[9px] px-[15px] py-[9px] text-[13px]",
  lg: "rounded-[11px] px-[22px] py-[13px] text-base",
};

export default function Button({
  variant = "primary",
  size = "md",
  icon,
  type = "button",
  className = "",
  children,
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={
        "inline-flex min-h-[36px] items-center justify-center gap-1.5 font-semibold " +
        "transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60 " +
        "disabled:cursor-not-allowed " +
        SIZES[size] +
        " " +
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
      {children}
    </button>
  );
}
