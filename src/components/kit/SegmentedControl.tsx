// SegmentedControl — switches context without navigating (per Navigation Map's
// SegmentedControl.dc.html). Quiet when inactive, clear when active. Used for the
// role switcher (3-option) and the language toggle (2-option pill). Generic over
// the option value type. Keyboard + screen-reader friendly (aria-pressed).

import type { ReactNode } from "react";

export interface SegmentItem<T extends string> {
  value: T;
  label: ReactNode;
  /** Decorative leading glyph. */
  icon?: ReactNode;
}

interface SegmentedControlProps<T extends string> {
  items: SegmentItem<T>[];
  value: T;
  onChange: (value: T) => void;
  /** Pill shape (999px) vs rounded (11/8px). */
  pill?: boolean;
  /** Make each segment fill equal width (panel tabs). */
  stretch?: boolean;
  /** Names the group for assistive tech. */
  ariaLabel: string;
  className?: string;
}

export default function SegmentedControl<T extends string>({
  items,
  value,
  onChange,
  pill = false,
  stretch = false,
  ariaLabel,
  className = "",
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className={
        "inline-flex gap-0.5 border border-wp-line bg-wp-surf2 p-[3px] " +
        (pill ? "rounded-full " : "rounded-[11px] ") +
        (stretch ? "w-full " : "") +
        className
      }
    >
      {items.map((item) => {
        const active = item.value === value;
        return (
          <button
            key={item.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(item.value)}
            className={
              "inline-flex min-h-[40px] items-center justify-center gap-1.5 px-4 text-[13px] " +
              "font-semibold transition focus-visible:outline-none focus-visible:ring-2 " +
              "focus-visible:ring-wp-acc/60 " +
              (pill ? "rounded-full " : "rounded-lg ") +
              (stretch ? "flex-1 " : "") +
              (active
                ? "bg-wp-surf4 text-wp-tx"
                : "bg-transparent text-wp-txd hover:text-wp-tx")
            }
          >
            {item.icon ? (
              <span aria-hidden="true" className="shrink-0">
                {item.icon}
              </span>
            ) : null}
            {item.label}
          </button>
        );
      })}
    </div>
  );
}
