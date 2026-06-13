// Foresight overflow alerts — the autonomous, aggregate-only agent's output.
// Each card shows the plain-language RATIONALE (never a bare signal), and a
// "pre-position resource" action that drops a marker on the rising bloom. The
// coordinator only ever sees aggregate area-level signal here — never base rows.

import { useTranslation } from "react-i18next";
import { Button, Icon, SectionLabel, Skeleton } from "../../components/kit";
import type { ForesightAlert } from "../../types";

interface ForesightAlertsProps {
  alerts: ForesightAlert[];
  loading?: boolean;
  positioned: Record<string, boolean>;
  onPrePosition: (alert: ForesightAlert) => void;
}

const SEVERITY_STYLE: Record<ForesightAlert["severity"], string> = {
  watch: "border-[rgba(216,182,92,0.3)] bg-[rgba(216,182,92,0.1)]",
  warning: "border-[rgba(227,106,125,0.32)] bg-[rgba(227,106,125,0.1)]",
};

const SEVERITY_CHIP: Record<ForesightAlert["severity"], string> = {
  watch: "bg-[rgba(216,182,92,0.18)] text-wp-low",
  warning: "bg-[rgba(227,106,125,0.18)] text-wp-full",
};

export default function ForesightAlerts({
  alerts,
  loading = false,
  positioned,
  onPrePosition,
}: ForesightAlertsProps) {
  const { t } = useTranslation();

  return (
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <SectionLabel className="mb-2.5">{t("coordinator.alerts.title")}</SectionLabel>
      {loading ? (
        <div className="space-y-2">
          <Skeleton className="h-16 w-full rounded-[12px]" label={t("coordinator.alerts.title")} />
          <Skeleton className="h-16 w-full rounded-[12px]" />
        </div>
      ) : alerts.length === 0 ? (
        <p className="text-xs text-wp-txf">{t("coordinator.alerts.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {alerts.map((a) => (
            <li
              key={a.id}
              className={"rounded-[12px] border p-3 " + SEVERITY_STYLE[a.severity]}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-semibold text-wp-tx">{a.area}</span>
                <span
                  className={
                    "rounded-full px-2 py-0.5 font-mono text-[10px] font-semibold uppercase tracking-wide " +
                    SEVERITY_CHIP[a.severity]
                  }
                >
                  {t(`coordinator.alerts.severity.${a.severity}`)}
                </span>
              </div>
              <p className="mt-1.5 text-xs leading-relaxed text-wp-txd">
                {a.rationale}
              </p>
              <Button
                variant={positioned[a.id] ? "confirm" : "primary"}
                size="sm"
                disabled={positioned[a.id]}
                onClick={() => onPrePosition(a)}
                icon={
                  positioned[a.id] ? (
                    <Icon name="check" size={16} />
                  ) : (
                    <Icon name="add_location_alt" size={16} />
                  )
                }
                className="mt-2.5 w-full"
              >
                {positioned[a.id]
                  ? t("coordinator.alerts.positioned")
                  : t("coordinator.alerts.prePosition")}
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
