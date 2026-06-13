// STUB — Lane 1 (map-engineer) replaces this with the real full-bleed MapLibre
// map: warm-dark basemap, zoom-keyed pins/routes/heat, and the real
// MapController wired into MapProvider. For now it's a placeholder that fills
// the screen so the App shell is provable. See .claude/rules/map.md.

import { useTranslation } from "react-i18next";

export default function MapView() {
  const { t } = useTranslation();
  return (
    <div
      className="absolute inset-0 grid place-items-center bg-waypoint-bg text-waypoint-accent/70"
      aria-label="map"
    >
      <p className="text-sm tracking-wide">{t("map.stub")}</p>
    </div>
  );
}
