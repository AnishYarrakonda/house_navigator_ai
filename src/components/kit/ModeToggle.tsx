// The two-mode switch: "I need help" ⟷ "Volunteer". A single sliding toggle
// (not a row of buttons) — one tap flips the whole app between the person side
// and the volunteer side. Keyboard + screen-reader friendly.

import type { ReactNode } from "react";

export interface ModeOption<T extends string> {
  value: T;
  label: string;
  icon?: ReactNode;
}

interface ModeToggleProps<T extends string> {
  options: [ModeOption<T>, ModeOption<T>];
  value: T;
  onChange: (value: T) => void;
  ariaLabel: string;
}

export default function ModeToggle<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
}: ModeToggleProps<T>) {
  const activeIndex = options[1].value === value ? 1 : 0;

  return (
    <div
      role="group"
      aria-label={ariaLabel}
      className="relative inline-flex items-center rounded-full border border-wp-line bg-[rgba(12,13,16,0.82)] p-1 shadow-wp-md backdrop-blur-[18px]"
    >
      {/* Sliding thumb */}
      <span
        aria-hidden
        className="absolute top-1 bottom-1 rounded-full bg-wp-acc transition-transform duration-200 ease-out"
        style={{
          width: "calc(50% - 4px)",
          left: 4,
          transform: activeIndex === 1 ? "translateX(100%)" : "translateX(0)",
        }}
      />
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            aria-pressed={active}
            onClick={() => onChange(opt.value)}
            className={
              "relative z-10 inline-flex min-h-[40px] items-center justify-center gap-1.5 rounded-full px-4 text-[13px] font-semibold transition-colors " +
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60 " +
              (active ? "text-white" : "text-wp-txd hover:text-wp-tx")
            }
          >
            {opt.icon ? (
              <span aria-hidden className="shrink-0">
                {opt.icon}
              </span>
            ) : null}
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}
