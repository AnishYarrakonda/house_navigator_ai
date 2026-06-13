// Results — the matching places that lit up on the map, nearest first. Each row
// is one big tap target; choosing it draws the route and opens the arrival card.
// Capacity is shown with a color-independent badge + a plain count; distance is
// approximate (we only ever know the fuzzed cell), phrased as a friendly walk.

import { useTranslation } from "react-i18next";
import { CapacityBadge } from "../../components/kit";
import { capacityTone, walkingMinutes, type RankedNode } from "./matching";

interface ResultsListProps {
  ranked: RankedNode[];
  onChoose: (ranked: RankedNode) => void;
}

export default function ResultsList({ ranked, onChoose }: ResultsListProps) {
  const { t } = useTranslation();

  if (ranked.length === 0) {
    return (
      <p className="rounded-2xl bg-white/5 p-4 text-base text-white/80">
        {t("crisis.results.empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-2">
      {ranked.map(({ node, meters }) => {
        const min = walkingMinutes(meters);
        const tone = capacityTone(node);
        return (
          <li key={node.id}>
            <button
              type="button"
              onClick={() => onChoose({ node, meters })}
              className={
                "flex w-full flex-col gap-2 rounded-2xl bg-white/10 p-4 text-left " +
                "transition hover:bg-white/15 active:bg-white/20 " +
                "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-waypoint-accent/60"
              }
            >
              <div className="flex items-start justify-between gap-3">
                <span className="text-base font-semibold text-white">
                  {node.name}
                </span>
                <CapacityBadge
                  tone={tone}
                  label={t("crisis.results.spotsOpen", {
                    count: node.capacity_open,
                  })}
                />
              </div>
              <span className="text-sm text-white/60">
                {min <= 0
                  ? t("crisis.results.nearby")
                  : t("crisis.results.walkMin", { min })}
                {" · "}
                {t("crisis.results.choose")}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}
