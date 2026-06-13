// Card — the glass surface container the panels float in over the map. Matches
// the Navigation Map screen panels: translucent dark surface, hairline border,
// 18px radius, heavy blur so the map (the hero) stays legible behind it.

import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={
        "rounded-[18px] border border-wp-line2 bg-[rgba(15,16,19,0.85)] p-5 " +
        "text-wp-tx shadow-wp-lg backdrop-blur-[22px] " +
        className
      }
    >
      {children}
    </div>
  );
}
