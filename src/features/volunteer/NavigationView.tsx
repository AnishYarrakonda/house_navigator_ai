// Turn-by-turn navigation for the volunteer flow. Driven entirely by the ORS
// `steps` of the selected route. Advance is MANUAL (next/prev) — there is NO GPS
// tracking and no location is stored (privacy.md: no live tracking). The active
// route is drawn on the map by the parent. Waypoint-native UI.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Button, Card, Icon, SectionLabel } from "../../components/kit";
import type { RouteStep } from "../../lib/routing";
import { maneuverIcon } from "./maneuver";
import { formatDistance, formatDuration, formatEta } from "./format";

interface NavigationViewProps {
  steps: RouteStep[];
  destinationLabel: string;
  onExit: () => void;
}

export default function NavigationView({
  steps,
  destinationLabel,
  onExit,
}: NavigationViewProps) {
  const { t } = useTranslation();
  const [index, setIndex] = useState(0);

  const current = steps[index];
  const next = steps[index + 1];
  const atEnd = index >= steps.length - 1;

  // Remaining distance/time = the current step plus everything still ahead.
  const remaining = useMemo(() => {
    let dist = 0;
    let dur = 0;
    for (let i = index; i < steps.length; i++) {
      dist += steps[i].distanceMeters;
      dur += steps[i].durationSeconds;
    }
    return { dist, dur };
  }, [steps, index]);

  if (!current) {
    return (
      <Card className="!p-4">
        <p className="text-sm text-wp-txd">{t("volunteer.nav.noSteps")}</p>
        <Button variant="secondary" onClick={onExit} className="mt-3 w-full">
          {t("volunteer.nav.exit")}
        </Button>
      </Card>
    );
  }

  return (
    <Card className="!p-4">
      <div className="flex items-center justify-between">
        <SectionLabel>{t("volunteer.nav.navigating")}</SectionLabel>
        <Button
          variant="ghost"
          size="sm"
          onClick={onExit}
          icon={<Icon name="close" size={18} />}
          data-no-drag
        >
          {t("volunteer.nav.exit")}
        </Button>
      </div>

      <p className="mt-1 truncate text-[12px] text-wp-txf">
        {t("volunteer.nav.to")} {destinationLabel}
      </p>

      {/* Current maneuver */}
      <div className="mt-3 flex items-center gap-3 rounded-[14px] border border-wp-line2 bg-wp-surf2 p-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-wp-acc/15 text-wp-acc">
          <Icon name={maneuverIcon(current.type)} size={28} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-snug text-wp-tx">
            {current.instruction}
          </p>
          {current.distanceMeters > 0 && (
            <p className="mt-0.5 text-[12px] text-wp-txd">
              {formatDistance(current.distanceMeters)}
            </p>
          )}
        </div>
      </div>

      {/* Next maneuver preview */}
      {next && (
        <div className="mt-2 flex items-center gap-2.5 px-1 text-wp-txd">
          <Icon name={maneuverIcon(next.type)} size={18} className="shrink-0" />
          <span className="min-w-0 flex-1 truncate text-[12px]">
            {t("volunteer.nav.then")} {next.instruction}
          </span>
        </div>
      )}

      {/* Trip remaining */}
      <div className="mt-3 flex items-center justify-between rounded-[12px] bg-wp-surf2 px-3 py-2 text-[13px]">
        <span className="font-semibold text-wp-tx">
          {formatDuration(remaining.dur)} · {formatDistance(remaining.dist)}
        </span>
        <span className="text-wp-txd">
          {t("volunteer.nav.eta")} {formatEta(remaining.dur)}
        </span>
      </div>

      {/* Manual step controls (no GPS) */}
      <div className="mt-3 flex items-center gap-2" data-no-drag>
        <Button
          variant="secondary"
          onClick={() => setIndex((i) => Math.max(0, i - 1))}
          disabled={index === 0}
          icon={<Icon name="arrow_back" size={18} />}
          className="min-h-[44px] flex-1"
        >
          {t("volunteer.nav.back")}
        </Button>
        <Button
          variant="primary"
          onClick={() => !atEnd && setIndex((i) => Math.min(steps.length - 1, i + 1))}
          disabled={atEnd}
          icon={<Icon name={atEnd ? "flag" : "arrow_forward"} size={18} />}
          className="min-h-[44px] flex-1"
        >
          {atEnd ? t("volunteer.nav.arrived") : t("volunteer.nav.next")}
        </Button>
      </div>

      <p className="mt-2 text-center text-[11px] text-wp-txf">
        {t("volunteer.nav.step")} {index + 1} / {steps.length}
      </p>
    </Card>
  );
}
