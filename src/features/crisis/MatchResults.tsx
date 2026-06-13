// MatchResults — the three picks the AI crew returned: Closest, Most resources,
// and the highlighted "Best overall" (balanced) recommendation. Each card shows
// the place name, the warm plain-language `why`, distance + ETA, a capacity
// indicator, a color swatch matching its route on the map, and a "See the way
// there" button. The balanced pick is visually elevated as the recommended
// choice. Tapping a card emphasizes that route on the map (others dim); the
// button commits the pick. Distance is approximate (we only ever know the fuzzed
// cell). All copy is i18n; tap targets ≥44px (accessibility.md).

import { useTranslation } from "react-i18next";
import { Button, CapacityBadge, Icon, RecommendedChip } from "../../components/kit";
import type { ResourceNode } from "../../types";
import type { MatchPick, MatchResult } from "../../lib/match";
import { ROUTE_COLORS, type PickKind } from "./useCrisisFlow";
import { capacityTone } from "./matching";

interface MatchResultsProps {
  matches: MatchResult;
  nodes: ResourceNode[];
  /** The pick currently emphasized on the map (null = none yet). */
  selectedKind: PickKind | null;
  /** Tap a card → emphasize its route (others dim). */
  onSelect: (kind: PickKind, pick: MatchPick) => void;
  /** Commit a pick → draw the way there and advance. */
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
  selectedKind,
  onSelect,
  onChoose,
}: MatchResultsProps) {
  const { t } = useTranslation();
  const byId = new Map(nodes.map((n) => [n.id, n]));

  // Order: Best overall (recommended) first, then Closest, then Most resources.
  // De-dupe so the same place doesn't appear twice when data is thin.
  const raw: { kind: PickKind; pick: MatchPick | null; labelKey: string; recommended: boolean }[] = [
    { kind: "balanced", pick: matches.balanced, labelKey: "crisis.results.bestOverall", recommended: true },
    { kind: "closest", pick: matches.closest, labelKey: "crisis.results.closest", recommended: false },
    { kind: "mostResources", pick: matches.mostResources, labelKey: "crisis.results.mostResources", recommended: false },
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
              kind={kind}
              label={t(labelKey)}
              recommended={recommended}
              selected={selectedKind === kind}
              onSelect={() => onSelect(kind, pick)}
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
  kind: PickKind;
  label: string;
  recommended: boolean;
  selected: boolean;
  onSelect: () => void;
  onChoose: () => void;
}

function PickCard({
  node,
  pick,
  kind,
  label,
  recommended,
  selected,
  onSelect,
  onChoose,
}: PickCardProps) {
  const { t } = useTranslation();
  const tone = capacityTone(node);
  const swatch = ROUTE_COLORS[kind];

  // The whole card is a tap target that emphasizes this option's route on the
  // map. The "See the way there" button (stopPropagation) commits the pick.
  return (
    <div
      role="button"
      tabIndex={0}
      aria-pressed={selected}
      onClick={onSelect}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect();
        }
      }}
      className={
        "flex cursor-pointer flex-col gap-3 rounded-[14px] border p-4 transition " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60 " +
        (selected
          ? "border-wp-acc bg-[rgba(47,109,246,0.10)] shadow-[0_8px_28px_rgba(47,109,246,0.18)]"
          : recommended
            ? "border-[rgba(47,109,246,0.4)] bg-[rgba(47,109,246,0.07)]"
            : "border-wp-line bg-wp-surf2")
      }
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="inline-flex items-center gap-1.5 font-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-wp-txf">
            <span
              className="inline-block h-2.5 w-2.5 rounded-full"
              style={{ backgroundColor: swatch }}
              aria-label={t("crisis.results.routeSwatch")}
              role="img"
            />
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
        {node.simulated ? (
          <span className="inline-flex items-center gap-1 rounded-full border border-wp-line2 bg-wp-surf px-2.5 py-1 text-[11px] text-wp-txf">
            <Icon name="science" size={13} />
            {t("crisis.results.demoData")}
          </span>
        ) : null}
      </div>

      <Button
        variant={selected || recommended ? "primary" : "secondary"}
        size="lg"
        onClick={(e) => {
          e.stopPropagation();
          onChoose();
        }}
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
