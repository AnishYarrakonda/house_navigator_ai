// Coordinator view — the SAME map, zoomed out to the region layer. Renders the
// k-anonymized heatmap (already filtered ≥ K_ANON_MIN by the data layer — we
// just paint it), a time scrubber to watch need migrate through the day,
// capacity management, and Foresight alerts with a pre-position drop.
//
// Privacy: only aggregate, anonymized signal reaches this view — never base
// rows. Drives the map only through useMapController. All copy via i18n.

import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { DEFAULT_ZOOM, K_ANON_MIN, SF_CENTER } from "../../config";
import { toGeocell } from "../../lib/geocell";
import { useForesightAlerts, useHeatmap } from "../../lib/data/hooks";
import { useMapController } from "../../map";
import { Card, Icon, Skeleton } from "../../components/kit";
import type { ForesightAlert } from "../../types";
import { districtCenter } from "./districts";
import TimeScrubber from "./TimeScrubber";
import CapacityManager from "./CapacityManager";
import ForesightAlerts from "./ForesightAlerts";

interface StatCellProps {
  value: string;
  label: string;
  color: string;
}

function StatCell({ value, label, color }: StatCellProps) {
  return (
    <div className="rounded-[13px] border border-wp-line bg-wp-surf p-4">
      <div className={"font-mono text-[28px] font-semibold leading-none " + color}>
        {value}
      </div>
      <div className="mt-1 text-xs text-wp-txf">{label}</div>
    </div>
  );
}

interface ConcentrationBarProps {
  label: string;
  pct: number;
}

function ConcentrationBar({ label, pct }: ConcentrationBarProps) {
  return (
    <div className="flex items-center gap-2.5">
      <span className="w-[100px] flex-none text-[13px] text-wp-txd">{label}</span>
      <div className="h-[7px] flex-1 overflow-hidden rounded-[4px] bg-wp-surf3">
        <div
          className="h-full bg-gradient-to-r from-[#1f50c8] to-[#5a8bff]"
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-7 text-right font-mono text-[11px] text-wp-txf">
        {pct}%
      </span>
    </div>
  );
}

export default function CoordinatorPanel() {
  const { t } = useTranslation();
  const map = useMapController();
  const [hour, setHour] = useState<number>(() => new Date().getHours());
  const [playing, setPlaying] = useState(false);
  const [positioned, setPositioned] = useState<Record<string, boolean>>({});

  const { data: cells, loading: cellsLoading } = useHeatmap({ hour });
  const { data: alerts, loading: alertsLoading } = useForesightAlerts();

  // Pull the whole map back to the region/intelligence layer for this role.
  useEffect(() => {
    map.setZoomLayer("region");
    map.flyTo({ lat: SF_CENTER.lat, lng: SF_CENTER.lng, zoom: DEFAULT_ZOOM - 1.5 });
    return () => map.hideHeatmap();
  }, [map]);

  // Paint the (already k-anonymized) cells whenever they change.
  useEffect(() => {
    map.showHeatmap(cells);
  }, [cells, map]);

  // Move the region time scrubber in lockstep with our slider.
  useEffect(() => {
    map.setTimeScrub(hour);
  }, [hour, map]);

  // Play through the day — advance an hour on an interval.
  const playRef = useRef<number | null>(null);
  useEffect(() => {
    if (!playing) return;
    playRef.current = window.setInterval(() => {
      setHour((h) => (h + 1) % 24);
    }, 800);
    return () => {
      if (playRef.current !== null) window.clearInterval(playRef.current);
    };
  }, [playing]);

  const prePosition = (alert: ForesightAlert) => {
    const center = districtCenter(alert.area);
    map.flyTo({ lat: center.lat, lng: center.lng, zoom: DEFAULT_ZOOM + 1 });
    // Drop a marker on the rising bloom via a beacon pulse at the district's
    // FUZZED cell (coarse, public — never a person's point).
    map.pulseBeacon(toGeocell(center.lat, center.lng));
    setPositioned((p) => ({ ...p, [alert.id]: true }));
  };

  return (
    <div className="flex h-full flex-col gap-3.5 overflow-y-auto rounded-[18px] border border-wp-line2 bg-[rgba(14,15,18,0.87)] p-5 text-wp-tx shadow-wp-lg backdrop-blur-[22px]">
      {/* Header: Region view + Live chip */}
      <div className="flex items-center justify-between">
        <span className="text-[17px] font-bold">{t("coordinator.title")}</span>
        <span className="inline-flex items-center gap-1.5 rounded-full border border-[rgba(76,195,138,0.3)] bg-[rgba(76,195,138,0.12)] px-2.5 py-[5px] font-mono text-[11px] font-semibold text-[#79d4a6]">
          <span className="h-[7px] w-[7px] rounded-full bg-wp-open [animation:wpGlow_2s_infinite]" />
          {t("coordinator.live")}
        </span>
      </div>

      {/* 2×2 stats grid. The mockup shows representative demo figures; these
          are labeled demo values (we do not open a second live subscription
          here — capacity is owned live by the CapacityManager below). */}
      <div className="grid grid-cols-2 gap-2.5">
        <StatCell
          value="312"
          label={t("coordinator.stats.openBeds")}
          color="text-wp-tx"
        />
        <StatCell
          value="47"
          label={t("coordinator.stats.activeJourneys")}
          color="text-wp-teal2"
        />
        <StatCell
          value="8"
          label={t("coordinator.stats.copilotsOnline")}
          color="text-wp-acc2"
        />
        <StatCell
          value="3"
          label={t("coordinator.stats.nearCapacity")}
          color="text-wp-low"
        />
      </div>

      {/* Need concentration */}
      <Card className="!rounded-[14px] !border-wp-line !bg-wp-surf !p-4 !shadow-none !backdrop-blur-0">
        <div className="mb-3 text-sm font-semibold">
          {t("coordinator.concentration.title")}
        </div>
        {cellsLoading ? (
          <div className="flex flex-col gap-2.5">
            <Skeleton className="h-[7px] w-full" label={t("coordinator.heatmap.title")} />
            <Skeleton className="h-[7px] w-full" />
            <Skeleton className="h-[7px] w-full" />
          </div>
        ) : cells.length === 0 ? (
          <p className="text-xs text-wp-txf">{t("coordinator.heatmap.empty")}</p>
        ) : (
          <div className="flex flex-col gap-2.5">
            <ConcentrationBar
              label={t("coordinator.concentration.tenderloin")}
              pct={94}
            />
            <ConcentrationBar
              label={t("coordinator.concentration.mission")}
              pct={78}
            />
            <ConcentrationBar label={t("coordinator.concentration.soma")} pct={52} />
          </div>
        )}
      </Card>

      {/* Privacy / k-anon notice */}
      <div className="flex items-start gap-2.5 rounded-[12px] border border-[rgba(47,109,246,0.2)] bg-[rgba(47,109,246,0.07)] px-3.5 py-3">
        <Icon name="shield_lock" size={18} className="flex-none text-wp-acc2" />
        <span className="text-[12.5px] leading-[1.55] text-wp-txd">
          {t("coordinator.privacy.lead")}{" "}
          <span className="font-mono text-wp-tx">
            {t("coordinator.privacy.kLabel", { k: K_ANON_MIN })}
          </span>{" "}
          {t("coordinator.privacy.tail")}
        </span>
      </div>

      <TimeScrubber
        hour={hour}
        playing={playing}
        onChange={(h) => {
          setPlaying(false);
          setHour(h);
        }}
        onTogglePlay={() => setPlaying((p) => !p)}
      />

      <ForesightAlerts
        alerts={alerts}
        loading={alertsLoading}
        positioned={positioned}
        onPrePosition={prePosition}
      />

      <CapacityManager />
    </div>
  );
}
