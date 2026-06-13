// CapacityBadge — shows how full a resource is (per Navigation Map's
// CapacityChip). Capacity state is NEVER conveyed by color alone
// (accessibility.md): each tone pairs a color with a distinct shape marker
// (● open / ◆ filling / call-icon full) AND a caller-localized label. The kit is
// string-free — the caller owns the words. An optional mono `count` renders
// before the label.

import Icon from "./Icon";

type Tone = "open" | "filling" | "full";

interface CapacityBadgeProps {
  /** Caller-localized text, e.g. "open", "left", "Full — call". */
  label: string;
  tone: Tone;
  /** Optional count rendered in mono before the label. */
  count?: number;
}

const TONES: Record<Tone, string> = {
  open: "bg-[rgba(76,195,138,0.12)] text-[#79d4a6] border-[rgba(76,195,138,0.32)]",
  filling:
    "bg-[rgba(216,182,92,0.12)] text-[#e0c878] border-[rgba(216,182,92,0.32)]",
  full: "bg-[rgba(227,106,125,0.12)] text-[#ef8896] border-[rgba(227,106,125,0.32)]",
};

// The redundant, color-independent shape cue.
function ToneMarker({ tone }: { tone: Tone }) {
  if (tone === "full") return <Icon name="call" size={14} />;
  if (tone === "filling")
    return (
      <span
        aria-hidden="true"
        className="h-2 w-2 shrink-0 rotate-45 bg-[#d8b65c]"
      />
    );
  return (
    <span
      aria-hidden="true"
      className="h-2 w-2 shrink-0 rounded-full bg-[#4cc38a]"
    />
  );
}

export default function CapacityBadge({
  label,
  tone,
  count,
}: CapacityBadgeProps) {
  return (
    <span
      className={
        "inline-flex items-center gap-[7px] rounded-full border px-3 py-1.5 text-[13px] " +
        "font-semibold " +
        TONES[tone]
      }
    >
      <ToneMarker tone={tone} />
      {count !== undefined && (
        <span className="font-mono text-xs">{count}</span>
      )}
      {label}
    </span>
  );
}
