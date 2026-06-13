// Results — the matching places that lit up on the map, nearest first. Each row
// is one big tap target; choosing it draws the route and opens the arrival card.
// Capacity is shown with a color-independent badge + a plain count; distance is
// approximate (we only ever know the fuzzed cell), phrased as a friendly walk.
// Styled to the design system's place rows; the nearest match is recommended.

import { useTranslation } from "react-i18next";
import { CapacityBadge, RecommendedChip } from "../../components/kit";
import { capacityTone, walkingMinutes, type RankedNode } from "./matching";

interface ResultsListProps {
  ranked: RankedNode[];
  onChoose: (ranked: RankedNode) => void;
}

export default function ResultsList({ ranked, onChoose }: ResultsListProps) {
  const { t } = useTranslation();

  if (ranked.length === 0) {
    return (
      <p className="rounded-[12px] border border-wp-line bg-wp-surf2 p-4 text-base text-wp-txd">
        {t("crisis.results.empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2.5">
      {ranked.map(({ node, meters }, i) => {
        const min = walkingMinutes(meters);
        const tone = capacityTone(node);
        const recommended = i === 0;
        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onChoose({ node, meters })}
              className={
                "flex w-full flex-col gap-2.5 rounded-[12px] border p-4 text-left transition " +
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60 " +
                (recommended
                  ? "border-[rgba(47,109,246,0.35)] bg-[rgba(47,109,246,0.05)] hover:bg-[rgba(47,109,246,0.1)]"
                  : "border-wp-line bg-wp-surf2 hover:bg-wp-surf3")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-semibold text-wp-tx">
                  {node.name}
                </span>
                {recommended ? (
                  <RecommendedChip label={t("crisis.results.recommended")} />
                ) : null}
              </div>
              <div className="flex items-center justify-between gap-3">
                <span className="font-mono text-[11px] text-wp-txf">
                  {min <= 0
                    ? t("crisis.results.nearby")
                    : t("crisis.results.walkMin", { min })}
                  {" · "}
                  {t("crisis.results.choose")}
                </span>
                <CapacityBadge
                  tone={tone}
                  label={t("crisis.results.spotsOpen", {
                    count: node.capacity_open,
                  })}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
