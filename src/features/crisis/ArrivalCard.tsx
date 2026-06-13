// Arrival card — plain-language, trauma-informed "what to expect when you
// arrive" (accessibility.md): short, warm, concrete. Frames the chosen node's
// real data (name / hours) with reassuring i18n copy. This is the static M1
// placeholder for what the Navigator Agent will draft per-node in M2/M3.

import { useTranslation } from "react-i18next";
import { BigButton } from "../../components/kit";
import { RouteIcon } from "./icons";
import type { ResourceNode } from "../../types";

interface ArrivalCardProps {
  node: ResourceNode;
  onDone: () => void;
}

export default function ArrivalCard({ node, onDone }: ArrivalCardProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-waypoint-accent">
        <RouteIcon size={22} />
        <h2 className="text-lg font-semibold text-white">
          {t("crisis.arrival.title")}
        </h2>
      </div>

      <p className="text-base font-semibold text-white">{node.name}</p>

      {node.hours ? (
        <p className="text-sm text-white/80">
          <span className="text-white/50">{t("crisis.arrival.hours")} </span>
          {node.hours}
        </p>
      ) : null}

      <ul className="flex list-none flex-col gap-2 text-sm text-white/80">
        <li>• {t("crisis.arrival.point1")}</li>
        <li>• {t("crisis.arrival.point2")}</li>
        <li>• {t("crisis.arrival.point3")}</li>
      </ul>

      <p className="rounded-xl bg-white/5 p-3 text-sm text-white/70">
        {t("crisis.arrival.reassure")}
      </p>

      <BigButton onClick={onDone}>{t("crisis.arrival.done")}</BigButton>
    </div>
  );
}
