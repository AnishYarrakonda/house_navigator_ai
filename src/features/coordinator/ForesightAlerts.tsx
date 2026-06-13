// Foresight overflow alerts — the autonomous, aggregate-only agent's output.
// Each card shows the plain-language RATIONALE (never a bare signal), and a
// "pre-position resource" action that drops a marker on the rising bloom. The
// coordinator only ever sees aggregate area-level signal here — never base rows.

import { useTranslation } from "react-i18next";
import type { ForesightAlert } from "../../types";

interface ForesightAlertsProps {
  alerts: ForesightAlert[];
  positioned: Record<string, boolean>;
  onPrePosition: (alert: ForesightAlert) => void;
}

const SEVERITY_STYLE: Record<ForesightAlert["severity"], string> = {
  watch: "bg-amber-400/15 text-amber-100 ring-amber-400/30",
  warning: "bg-rose-500/15 text-rose-100 ring-rose-500/30",
};

export default function ForesightAlerts({
  alerts,
  positioned,
  onPrePosition,
}: ForesightAlertsProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <h3 className="text-sm font-semibold">{t("coordinator.alerts.title")}</h3>
      {alerts.length === 0 ? (
        <p className="mt-2 text-xs text-white/50">
          {t("coordinator.alerts.empty")}
        </p>
      ) : (
        <ul className="mt-2 space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={"rounded-lg p-2.5 ring-1 " + SEVERITY_STYLE[a.severity]}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{a.area}</span>
                <span className="rounded-full bg-black/20 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide">
                  {t(`coordinator.alerts.severity.${a.severity}`)}
                </span>
              </div>
              <p className="mt-1 text-xs leading-relaxed text-white/90">
                {a.rationale}
              </p>
              <button
                type="button"
                onClick={() => onPrePosition(a)}
                disabled={positioned[a.id]}
                className="mt-2 min-h-[44px] w-full rounded-lg bg-white/90 px-3 py-2 text-xs font-semibold text-waypoint-bg disabled:bg-white/20 disabled:text-white/60"
              >
                {positioned[a.id]
                  ? t("coordinator.alerts.positioned")
                  : t("coordinator.alerts.prePosition")}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
