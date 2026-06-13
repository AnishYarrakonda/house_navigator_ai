// Capacity overview + light management. Reads LIVE capacity from useNodes (so a
// co-pilot confirming a bed drops the number here too — the shared blackboard at
// work). Steppers apply a local delta overlay; the frozen data contract has no
// capacity setter, so we don't fake persistence — adjustments are labeled local.
// Capacity state is shown by color AND label (never color alone — a11y).

import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useNodes } from "../../lib/data/hooks";
import { RESOURCE_ICON } from "./icons";

type State = "open" | "limited" | "full";

function stateFor(open: number, total: number): State {
  if (open <= 0) return "full";
  if (total > 0 && open / total < 0.34) return "limited";
  return "open";
}

const STATE_STYLE: Record<State, { bar: string; chip: string }> = {
  open: { bar: "bg-emerald-400", chip: "bg-emerald-400/20 text-emerald-200" },
  limited: { bar: "bg-amber-400", chip: "bg-amber-400/20 text-amber-100" },
  full: { bar: "bg-rose-500", chip: "bg-rose-500/20 text-rose-200" },
};

export default function CapacityManager() {
  const { t } = useTranslation();
  const { data: nodes } = useNodes();
  const [delta, setDelta] = useState<Record<string, number>>({});

  const bump = (id: string, by: number) =>
    setDelta((d) => ({ ...d, [id]: (d[id] ?? 0) + by }));

  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <h3 className="text-sm font-semibold">{t("coordinator.capacity.title")}</h3>
      <ul className="mt-2 max-h-56 space-y-2 overflow-y-auto pr-1">
        {nodes.map((n) => {
          const open = Math.max(
            0,
            Math.min(n.capacity_total, n.capacity_open + (delta[n.id] ?? 0)),
          );
          const st = stateFor(open, n.capacity_total);
          const pct =
            n.capacity_total > 0 ? (open / n.capacity_total) * 100 : 0;
          return (
            <li key={n.id} className="rounded-lg bg-white/5 p-2">
              <div className="flex items-center gap-2">
                <span aria-hidden="true">{RESOURCE_ICON[n.type]}</span>
                <span className="min-w-0 flex-1 truncate text-xs font-medium">
                  {n.name}
                </span>
                <span
                  className={
                    "rounded-full px-1.5 py-0.5 text-[10px] font-semibold " +
                    STATE_STYLE[st].chip
                  }
                >
                  {t(`coordinator.capacity.state.${st}`)}
                </span>
              </div>
              <div className="mt-1.5 flex items-center gap-2">
                <div
                  className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10"
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
                <span className="w-24 shrink-0 text-right text-[10px] tabular-nums text-white/60">
                  {t("coordinator.capacity.open", {
                    open,
                    total: n.capacity_total,
                  })}
                </span>
                <div className="flex shrink-0 gap-1">
                  <button
                    type="button"
                    onClick={() => bump(n.id, -1)}
                    aria-label="−1"
                    className="h-7 w-7 rounded-md bg-white/10 text-sm font-bold leading-none hover:bg-white/20"
                  >
                    −
                  </button>
                  <button
                    type="button"
                    onClick={() => bump(n.id, 1)}
                    aria-label="+1"
                    className="h-7 w-7 rounded-md bg-white/10 text-sm font-bold leading-none hover:bg-white/20"
                  >
                    +
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>
      <p className="mt-2 text-[10px] text-white/40">
        {t("coordinator.capacity.localNote")}
      </p>
    </div>
  );
}
