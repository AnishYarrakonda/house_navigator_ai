// Card — the warm-dark surface container the crisis panels sit in. Floats over
// the map with a subtle blur so the map (the hero) stays visible behind it.

import type { ReactNode } from "react";

interface CardProps {
  children: ReactNode;
  className?: string;
}

export default function Card({ children, className = "" }: CardProps) {
  return (
    <div
      className={
        "rounded-2xl bg-waypoint-surface/95 p-4 text-white shadow-xl backdrop-blur " +
        className
      }
    >
      {children}
    </div>
  );
}
