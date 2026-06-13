// Inline SVG glyphs for the crisis side. Inline (not an icon library) to keep
// the crisis-path bundle light for old/low-data devices (accessibility.md).
// All decorative — every glyph is paired with a localized text label at the
// call site, so these are marked aria-hidden and carry no meaning alone.

import type { ReactNode, SVGProps } from "react";

const base: SVGProps<SVGSVGElement> = {
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.8,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  viewBox: "0 0 24 24",
  "aria-hidden": true,
};

function Glyph({ size = 36, children }: { size?: number; children: ReactNode }) {
  return (
    <svg {...base} width={size} height={size}>
      {children}
    </svg>
  );
}

/** A hand reaching up — the "I need help" home action. */
export function HelpIcon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M12 3a4 4 0 0 1 4 4v6" />
      <path d="M8 13V8a2 2 0 1 1 4 0" />
      <path d="M8 13v-2a2 2 0 1 0-4 0v3a7 7 0 0 0 7 7h1a6 6 0 0 0 6-6v-2" />
    </Glyph>
  );
}

/** Bed — "somewhere safe tonight". */
export function BedIcon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M3 7v11" />
      <path d="M3 13h18v5" />
      <path d="M21 18v-4a3 3 0 0 0-3-3H9v2" />
      <circle cx="6.5" cy="10.5" r="1.5" />
    </Glyph>
  );
}

/** Bowl + steam — food. */
export function FoodIcon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 12h16a8 8 0 0 1-16 0Z" />
      <path d="M2 12h20" />
      <path d="M9 4c-.8.8-.8 1.7 0 2.5M13 4c-.8.8-.8 1.7 0 2.5" />
    </Glyph>
  );
}

/** Shower head + drops — hygiene. */
export function ShowerIcon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 14a8 8 0 0 1 16 0Z" />
      <path d="M12 6V3" />
      <path d="M8 18v1M12 18v2M16 18v1" />
    </Glyph>
  );
}

/** Cross in a circle — medical. */
export function MedicalIcon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 8v8M8 12h8" />
    </Glyph>
  );
}

/** Speech bubble — someone to talk to. */
export function TalkIcon({ size }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M4 5h16v11H8l-4 4V5Z" />
      <path d="M9 10h.01M12 10h.01M15 10h.01" />
    </Glyph>
  );
}

/** Left chevron — back. */
export function BackIcon({ size = 24 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <path d="M15 6l-6 6 6 6" />
    </Glyph>
  );
}

/** Globe — language toggle. */
export function GlobeIcon({ size = 20 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
    </Glyph>
  );
}

/** Walking route marker — arrival. */
export function RouteIcon({ size = 24 }: { size?: number }) {
  return (
    <Glyph size={size}>
      <circle cx="6" cy="6" r="2" />
      <circle cx="18" cy="18" r="2" />
      <path d="M6 8v4a4 4 0 0 0 4 4h4" />
    </Glyph>
  );
}
