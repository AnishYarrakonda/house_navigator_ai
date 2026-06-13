// SectionLabel — the mono, uppercase, faint caption used to title sections and
// groups across the design system (e.g. "Walking alongside", "All variants").

import type { ReactNode } from "react";

interface SectionLabelProps {
  children: ReactNode;
  className?: string;
}

export default function SectionLabel({
  children,
  className = "",
}: SectionLabelProps) {
  return (
    <div
      className={
        "font-mono text-[11px] uppercase tracking-[0.12em] text-wp-txf " + className
      }
    >
      {children}
    </div>
  );
}
