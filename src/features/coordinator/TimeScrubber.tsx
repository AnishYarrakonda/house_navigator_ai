// Region-view time scrubber — slide (or play) through the hours of a day to
// watch need migrate. Presentational: the panel owns the hour + playing state
// and wires each change to mapController.setTimeScrub + a heatmap re-fetch.
//
// Visual: a gradient track (accd→acc2) with a glowing white handle and mono
// 6 AM / 12 PM / 6 PM / 12 AM ticks. The range <input> stays the operable
// control (keyboard + pointer) — it's layered transparently over the track so
// the slider semantics are preserved.

import { useTranslation } from "react-i18next";
import { Icon } from "../../components/kit";

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
  const pct = (hour / 23) * 100;

  return (
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <div className="mb-3 flex items-center justify-between">
        <span className="text-[13px] text-wp-txd">
          {t("coordinator.scrubber.label")}
        </span>
        <span className="font-mono text-[13px] tabular-nums text-wp-tx">
          {t("coordinator.scrubber.hour", {
            hour: String(hour).padStart(2, "0"),
          })}
        </span>
      </div>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onTogglePlay}
          aria-pressed={playing}
          aria-label={
            playing
              ? t("coordinator.scrubber.pause")
              : t("coordinator.scrubber.play")
          }
          className="flex h-9 w-9 flex-none items-center justify-center rounded-[9px] border border-[rgba(47,109,246,0.3)] bg-[rgba(47,109,246,0.14)] text-wp-acc2 transition hover:bg-[rgba(47,109,246,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/60"
        >
          <Icon name={playing ? "pause" : "play_arrow"} size={20} fill />
        </button>

        <div className="relative flex-1">
          {/* Track + filled gradient + glowing handle (decorative; the input
              below drives interaction). */}
          <div className="relative h-[6px] rounded-[3px] bg-wp-surf3">
            <div
              className="absolute left-0 top-0 h-full rounded-[3px] bg-gradient-to-r from-[#1f50c8] to-[#5a8bff]"
              style={{ width: `${pct}%` }}
            />
            <div
              className="pointer-events-none absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-wp-acc bg-white shadow-[0_0_10px_rgba(47,109,246,0.6)]"
              style={{ left: `${pct}%` }}
            />
          </div>
          <input
            type="range"
            min={0}
            max={23}
            step={1}
            value={hour}
            onChange={(e) => onChange(Number(e.target.value))}
            aria-label={t("coordinator.scrubber.label")}
            className="absolute inset-x-0 top-1/2 h-4 w-full -translate-y-1/2 cursor-pointer appearance-none bg-transparent opacity-0 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:appearance-none"
          />
        </div>
      </div>

      <div className="mt-2 flex justify-between font-mono text-[10px] text-wp-txf">
        <span>{t("coordinator.scrubber.tickMorning")}</span>
        <span>{t("coordinator.scrubber.tickNoon")}</span>
        <span>{t("coordinator.scrubber.tickEvening")}</span>
        <span>{t("coordinator.scrubber.tickMidnight")}</span>
      </div>
    </div>
  );
}
