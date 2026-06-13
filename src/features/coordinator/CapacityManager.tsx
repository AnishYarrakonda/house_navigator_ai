// Capacity overview + light management. Reads LIVE capacity from useNodes (so a
// co-pilot confirming a bed drops the number here too — the shared blackboard at
// work). Steppers apply a local delta overlay; the frozen data contract has no
// capacity setter, so we don't fake persistence — adjustments are labeled local.
// Capacity state is shown by color AND label (never color alone — a11y).

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNodes } from "../../lib/data/hooks";
import { Icon, IconButton, SectionLabel, Skeleton } from "../../components/kit";
import { RESOURCE_ICON } from "./icons";

type State = "open" | "limited" | "full";

function stateFor(open: number, total: number): State {
  if (open <= 0) return "full";
  if (total > 0 && open / total < 0.34) return "limited";
  return "open";
}

const STATE_STYLE: Record<State, { bar: string; chip: string }> = {
  open: { bar: "bg-wp-open", chip: "bg-[rgba(76,195,138,0.18)] text-wp-open" },
  limited: { bar: "bg-wp-low", chip: "bg-[rgba(216,182,92,0.18)] text-wp-low" },
  full: { bar: "bg-wp-full", chip: "bg-[rgba(227,106,125,0.18)] text-wp-full" },
};

export default function CapacityManager() {
  const { t } = useTranslation();
  const { data: nodes, loading } = useNodes();
  const [delta, setDelta] = useState<Record<string, number>>({});

  const bump = (id: string, by: number) =>
    setDelta((d) => ({ ...d, [id]: (d[id] ?? 0) + by }));

  return (
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <SectionLabel className="mb-2.5">{t("coordinator.capacity.title")}</SectionLabel>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-[10px]" label={t("coordinator.capacity.title")} />
          <Skeleton className="h-12 w-full rounded-[10px]" />
          <Skeleton className="h-12 w-full rounded-[10px]" />
        </div>
      ) : (
        <ul className="max-h-56 space-y-2 overflow-y-auto pr-1">
          {nodes.map((n) => {
            const open = Math.max(
              0,
              Math.min(n.capacity_total, n.capacity_open + (delta[n.id] ?? 0)),
            );
            const st = stateFor(open, n.capacity_total);
            const pct =
              n.capacity_total > 0 ? (open / n.capacity_total) * 100 : 0;
            return (
              <li key={n.id} className="rounded-[10px] border border-wp-line bg-wp-surf2 p-2.5">
                <div className="flex items-center gap-2">
                  <span aria-hidden="true">{RESOURCE_ICON[n.type]}</span>
                  <span className="min-w-0 flex-1 truncate text-xs font-medium text-wp-tx">
                    {n.name}
                  </span>
                  <span
                    className={
                      "rounded-full px-1.5 py-0.5 font-mono text-[10px] font-semibold " +
                      STATE_STYLE[st].chip
                    }
                  >
                    {t(`coordinator.capacity.state.${st}`)}
                  </span>
                </div>
                <div className="mt-1.5 flex items-center gap-2">
                  <div
                    className="h-1.5 flex-1 overflow-hidden rounded-full bg-wp-surf3"
                    role="progressbar"
                    aria-valuenow={open}
                    aria-valuemin={0}
                    aria-valuemax={n.capacity_total}
                  >
                    <div
                      className={"h-full rounded-full " + STATE_STYLE[st].bar}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  <span className="w-24 shrink-0 text-right font-mono text-[10px] tabular-nums text-wp-txf">
                    {t("coordinator.capacity.open", {
                      open,
                      total: n.capacity_total,
                    })}
                  </span>
                  <div className="flex shrink-0 gap-1">
                    <IconButton
                      label="−1"
                      onClick={() => bump(n.id, -1)}
                      icon={<Icon name="remove" size={18} />}
                      className="!h-8 !w-8 rounded-md border border-wp-line bg-wp-surf3"
                    />
                    <IconButton
                      label="+1"
                      onClick={() => bump(n.id, 1)}
                      icon={<Icon name="add" size={18} />}
                      className="!h-8 !w-8 rounded-md border border-wp-line bg-wp-surf3"
                    />
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p className="mt-2 text-[10px] text-wp-txf">
        {t("coordinator.capacity.localNote")}
      </p>
    </div>
  );
}
