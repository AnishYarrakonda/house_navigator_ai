// MatchResults — the three picks the crew returned: Closest, Best fit, and the
// highlighted "Best overall" (balanced) recommendation. Each card shows the
// place name, the warm plain-language `why`, distance + ETA, a capacity
// indicator, and a "See the way there" button. The balanced pick is visually
// elevated as the recommended choice. Distance is approximate (we only ever know
// the fuzzed cell). All copy is i18n; tap targets ≥44px (accessibility.md).

import { useTranslation } from "react-i18next";
import { Button, CapacityBadge, Icon, RecommendedChip } from "../../components/kit";
import type { ResourceNode } from "../../types";
import type { MatchPick, MatchResult } from "../../lib/match";
import type { PickKind } from "./useCrisisFlow";
import { capacityTone } from "./matching";

interface MatchResultsProps {
  matches: MatchResult;
  nodes: ResourceNode[];
  onChoose: (kind: PickKind, pick: MatchPick) => void;
}

interface CardSpec {
  kind: PickKind;
  pick: MatchPick;
  labelKey: string;
  recommended: boolean;
}

export default function MatchResults({
  matches,
  nodes,
  onChoose,
}: MatchResultsProps) {
  const { t } = useTranslation();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Order: Best overall (recommended) first, then Closest, then Best fit.
  // De-dupe so the same place doesn't appear twice when data is thin.
  const raw: { kind: PickKind; pick: MatchPick | null; labelKey: string; recommended: boolean }[] = [
    { kind: "balanced", pick: matches.balanced, labelKey: "crisis.results.bestOverall", recommended: true },
    { kind: "closest", pick: matches.closest, labelKey: "crisis.results.closest", recommended: false },
    { kind: "bestFit", pick: matches.bestFit, labelKey: "crisis.results.bestFit", recommended: false },
  ];

  const seen = new Set<string>();
  const cards: CardSpec[] = [];
  for (const r of raw) {
    if (!r.pick) continue;
    if (seen.has(r.pick.node_id)) continue;
    seen.add(r.pick.node_id);
    cards.push({ kind: r.kind, pick: r.pick, labelKey: r.labelKey, recommended: r.recommended });
  }

  if (cards.length === 0) {
    return (
      <p className="rounded-[12px] border border-wp-line bg-wp-surf2 p-4 text-base text-wp-txd">
        {t("crisis.results.empty")}
      </p>
    );
  }

  return (
    <ul className="flex flex-col gap-3">
      {cards.map(({ kind, pick, labelKey, recommended }) => {
        const node = byId.get(pick.node_id);
        if (!node) return null;
        return (
          <li key={kind}>
            <PickCard
              node={node}
              pick={pick}
              label={t(labelKey)}
              recommended={recommended}
              onChoose={() => onChoose(kind, pick)}
            />
          </li>
        );
      })}
    </ul>
  );
}

interface PickCardProps {
  node: ResourceNode;
  pick: MatchPick;
  label: string;
  recommended: boolean;
  onChoose: () => void;
}

function PickCard({ node, pick, label, recommended, onChoose }: PickCardProps) {
  const { t } = useTranslation();
  const tone = capacityTone(node);

  return (
    <div
      className={
        "flex flex-col gap-3 rounded-[14px] border p-4 transition " +
        (recommended
          ? "border-[rgba(47,109,246,0.4)] bg-[rgba(47,109,246,0.07)] shadow-[0_8px_28px_rgba(47,109,246,0.14)]"
          : "border-wp-line bg-wp-surf2")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-wp-txf">
            {label}
          </span>
          <span className="text-base font-semibold text-wp-tx">{node.name}</span>
        </div>
        {recommended ? (
          <RecommendedChip label={t("crisis.results.recommended")} />
        ) : null}
      </div>

      <p className="text-sm leading-snug text-wp-txd">{pick.why}</p>

      <div className="flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-1.5 rounded-full border border-wp-line2 bg-wp-surf px-3 py-1.5 text-[13px] text-wp-txd">
          <Icon name="directions_walk" size={15} className="text-wp-acc2" />
          {t("crisis.results.distanceEta", {
            min: pick.etaMinutes,
            blocks: blocksAway(pick.distanceMeters),
          })}
        </span>
        <CapacityBadge
          tone={tone}
          label={t("crisis.results.spotsOpen", { count: node.capacity_open })}
        />
      </div>

      <Button
        variant={recommended ? "primary" : "secondary"}
        size="lg"
        onClick={onChoose}
        icon={<Icon name="turn_right" size={18} />}
        className="w-full"
      >
        {t("crisis.results.seeTheWay")}
      </Button>
    </div>
  );
}

/** Friendly "~N blocks" from metres (a block ≈ 100m), min 1. */
function blocksAway(meters: number): number {
  return Math.max(1, Math.round(meters / 100));
}
