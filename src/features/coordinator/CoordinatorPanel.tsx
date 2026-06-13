// STUB — Lane 3 (volunteer-coordinator-frontend) builds the coordinator view
// here: zoomed-out k-anon heatmap, capacity management, pre-position drop, and
// Foresight alerts.

import { useTranslation } from "react-i18next";

export default function CoordinatorPanel() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-waypoint-surface/90 p-4 text-white shadow-xl backdrop-blur">
      <p className="text-sm">{t("coordinator.panelStub")}</p>
    </div>
  );
}
