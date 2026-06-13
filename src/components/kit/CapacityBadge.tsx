// CapacityBadge — shows how full a resource is. Capacity state is NEVER conveyed
// by color alone (accessibility.md): each tone pairs a color with a distinct
// shape glyph AND a text label the caller passes (so it stays i18n'd). The kit
// is string-free — the caller owns the words.

type Tone = "open" | "filling" | "full";

interface CapacityBadgeProps {
  /** Caller-localized text, e.g. "12 open" or "Open now". */
  label: string;
  tone: Tone;
}

// Shape + color per tone — the shape is the redundant, color-independent cue.
const TONES: Record<Tone, { glyph: string; className: string }> = {
  open: { glyph: "●", className: "bg-emerald-500/15 text-emerald-300" },
  filling: { glyph: "◐", className: "bg-amber-500/15 text-amber-300" },
  full: { glyph: "✕", className: "bg-rose-500/15 text-rose-300" },
};

export default function CapacityBadge({ label, tone }: CapacityBadgeProps) {
  const { glyph, className } = TONES[tone];
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs " +
        "font-semibold " +
        className
      }
    >
      <span aria-hidden="true">{glyph}</span>
      {label}
    </span>
  );
}
