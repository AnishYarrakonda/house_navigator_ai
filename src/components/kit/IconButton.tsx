// IconButton — an icon-only control (e.g. back). Because there is no visible
// text, `label` is REQUIRED and becomes the aria-label so screen readers and
// the accessibility checks pass. Minimum 44×44 tap target (WCAG AA).

import type { ButtonHTMLAttributes, ReactNode } from "react";

interface IconButtonProps
  extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, "aria-label"> {
  icon: ReactNode;
  /** Required — there's no visible text, so this names the control. */
  label: string;
}

export default function IconButton({
  icon,
  label,
  type = "button",
  className = "",
  ...rest
}: IconButtonProps) {
  return (
    <button
      type={type}
      aria-label={label}
      className={
        "flex h-11 w-11 items-center justify-center rounded-full text-wp-txd " +
        "transition hover:bg-wp-surf3 hover:text-wp-tx focus-visible:outline-none " +
        "focus-visible:ring-4 focus-visible:ring-wp-acc/60 " +
        className
      }
      {...rest}
    >
      <span aria-hidden="true">{icon}</span>
    </button>
  );
}
