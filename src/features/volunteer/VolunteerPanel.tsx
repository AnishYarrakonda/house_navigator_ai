// STUB — Lane 3 (volunteer-coordinator-frontend) builds the co-pilot side here:
// inbound need cards → accept (HITL) → confirm resource (live capacity drop) →
// message thread → journey roster.

import { useTranslation } from "react-i18next";

export default function VolunteerPanel() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-waypoint-surface/90 p-4 text-white shadow-xl backdrop-blur">
      <p className="text-sm">{t("volunteer.panelStub")}</p>
    </div>
  );
}
