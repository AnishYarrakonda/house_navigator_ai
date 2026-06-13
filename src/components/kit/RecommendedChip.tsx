// RecommendedChip — the small cobalt "Recommended" pill the Triage / PlaceCard
// flows put on the top-ranked option (per Navigation Map's CapacityChip special
// state). Caller passes the localized label so it stays i18n'd.

interface RecommendedChipProps {
  label: string;
}

export default function RecommendedChip({ label }: RecommendedChipProps) {
  return (
    <span
      className={
        "inline-flex items-center gap-1.5 rounded-full border border-[rgba(47,109,246,0.3)] " +
        "bg-[rgba(47,109,246,0.12)] px-2.5 py-1 font-mono text-[10px] font-semibold " +
        "uppercase tracking-[0.07em] text-[#8fb2ff]"
      }
    >
      {label}
    </span>
  );
}
