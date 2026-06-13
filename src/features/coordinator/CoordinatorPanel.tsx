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
import { DEFAULT_ZOOM, SF_CENTER } from "../../config";
import { toGeocell } from "../../lib/geocell";
import { useForesightAlerts, useHeatmap } from "../../lib/data/hooks";
import { useMapController } from "../../map";
import type { ForesightAlert } from "../../types";
import { districtCenter } from "./districts";
import TimeScrubber from "./TimeScrubber";
import CapacityManager from "./CapacityManager";
import ForesightAlerts from "./ForesightAlerts";

export default function CoordinatorPanel() {
  const { t } = useTranslation();
  const map = useMapController();
  const [hour, setHour] = useState<number>(() => new Date().getHours());
  const [playing, setPlaying] = useState(false);
  const [positioned, setPositioned] = useState<Record<string, boolean>>({});

  const { data: cells } = useHeatmap({ hour });
  const { data: alerts } = useForesightAlerts();

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
    <div className="flex max-h-[78dvh] flex-col gap-3 overflow-y-auto rounded-2xl bg-waypoint-surface/90 p-4 text-white shadow-xl backdrop-blur">
      <div>
        <h2 className="text-sm font-semibold">{t("coordinator.title")}</h2>
        <p className="mt-0.5 text-[11px] text-white/50">
          {t("coordinator.kanonNote")}
        </p>
      </div>

      <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
        <h3 className="text-sm font-semibold">{t("coordinator.heatmap.title")}</h3>
        {cells.length === 0 && (
          <p className="mt-1 text-xs text-white/50">
            {t("coordinator.heatmap.empty")}
          </p>
        )}
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
        positioned={positioned}
        onPrePosition={prePosition}
      />

      <CapacityManager />
    </div>
  );
}
