// An inbound need beacon, as the co-pilot sees it BEFORE accepting:
// need type + a rough distance + "a few blocks from <public landmark>".
// Deliberately NO identity and NO precise location (privacy.md: volunteers see
// type + fuzzed cell + distance only, until mutual accept).

import { useTranslation } from "react-i18next";
import type { Need, ResourceNode } from "../../types";
import { NEED_ICON } from "./icons";
import { formatMiles, hoursUntil, milesFromVolunteer, nearestLandmark } from "./format";

interface NeedCardProps {
  need: Need;
  nodes: ResourceNode[];
  onAccept: (need: Need) => void;
}

export default function NeedCard({ need, nodes, onAccept }: NeedCardProps) {
  const { t } = useTranslation();
  const landmark = nearestLandmark(need.fuzzed_geocell, nodes);
  const dist = formatMiles(milesFromVolunteer(need.fuzzed_geocell));
  const hrsLeft = Math.max(0, Math.round(hoursUntil(need.expires_at)));
  const typeLabel = t(`volunteer.needType.${need.type}`);

  return (
    <div className="rounded-xl bg-waypoint-bg/60 p-3 ring-1 ring-white/10">
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">
          {NEED_ICON[need.type]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-semibold leading-tight">{typeLabel}</p>
          {landmark && (
            <p className="mt-0.5 text-xs text-white/70">
              {t("volunteer.inbound.nearLandmark", { place: landmark })}
            </p>
          )}
          <p className="mt-0.5 text-xs text-white/50">
            {t("volunteer.inbound.away", { dist })}
            {" · "}
            {hrsLeft <= 0
              ? t("volunteer.inbound.freshNew")
              : t("volunteer.inbound.freshHours", { hours: hrsLeft })}
          </p>
        </div>
      </div>
      <button
        type="button"
        onClick={() => onAccept(need)}
        className="mt-3 min-h-[44px] w-full rounded-lg bg-waypoint-accent px-4 py-2 text-sm font-semibold text-waypoint-bg transition hover:brightness-105"
      >
        {t("volunteer.inbound.accept")}
      </button>
    </div>
  );
}
