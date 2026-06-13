// An inbound need beacon, as the co-pilot sees it BEFORE accepting:
// need type + a rough distance + "a few blocks from <public landmark>".
// Deliberately NO identity and NO precise location (privacy.md: volunteers see
// type + fuzzed cell + distance only, until mutual accept).

import { useTranslation } from "react-i18next";
import type { Need, ResourceNode } from "../../types";
import { NEED_ICON } from "./icons";
import { formatMiles, hoursUntil, milesFromVolunteer, nearestLandmark } from "./format";
import { Button, Icon } from "../../components/kit";

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
    <div className="rounded-[14px] border border-wp-line bg-wp-surf p-4">
      <div className="flex items-start gap-3">
        <span
          className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] border border-wp-line2 bg-wp-surf2 text-wp-txd"
          aria-hidden="true"
        >
          <Icon name={NEED_ICON[need.type]} size={20} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[15px] font-semibold leading-tight text-wp-tx">
            {typeLabel}
          </p>
          {landmark && (
            <p className="mt-1 text-xs text-wp-txd">
              {t("volunteer.inbound.nearLandmark", { place: landmark })}
            </p>
          )}
          <p className="mt-1 font-mono text-[11px] text-wp-txf">
            {t("volunteer.inbound.away", { dist })}
            {" · "}
            {hrsLeft <= 0
              ? t("volunteer.inbound.freshNew")
              : t("volunteer.inbound.freshHours", { hours: hrsLeft })}
          </p>
        </div>
      </div>
      <Button
        variant="primary"
        onClick={() => onAccept(need)}
        className="mt-3 min-h-[44px] w-full"
      >
        {t("volunteer.inbound.accept")}
      </Button>
    </div>
  );
}
