// Region-view time scrubber — slide (or play) through the hours of a day to
// watch need migrate. Presentational: the panel owns the hour + playing state
// and wires each change to mapController.setTimeScrub + a heatmap re-fetch.

import { useTranslation } from "react-i18next";

interface TimeScrubberProps {
  hour: number;
  playing: boolean;
  onChange: (hour: number) => void;
  onTogglePlay: () => void;
}

export default function TimeScrubber({
  hour,
  playing,
  onChange,
  onTogglePlay,
}: TimeScrubberProps) {
  const { t } = useTranslation();
  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-white/70">
          {t("coordinator.scrubber.label")}
        </span>
        <span className="font-mono text-sm tabular-nums text-waypoint-accent">
          {t("coordinator.scrubber.hour", {
            hour: String(hour).padStart(2, "0"),
          })}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-pressed={playing}
          className="min-h-[44px] min-w-[44px] rounded-lg bg-waypoint-accent px-3 text-sm font-semibold text-waypoint-bg"
        >
          {playing ? t("coordinator.scrubber.pause") : t("coordinator.scrubber.play")}
        </button>
        <input
          type="range"
          min={0}
          max={23}
          step={1}
          value={hour}
          onChange={(e) => onChange(Number(e.target.value))}
          aria-label={t("coordinator.scrubber.label")}
          className="h-2 flex-1 cursor-pointer appearance-none rounded-full bg-white/15 accent-waypoint-accent"
        />
      </div>
    </div>
  );
}
