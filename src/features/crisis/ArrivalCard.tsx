// Arrival card — plain-language, trauma-informed "what to expect when you
// arrive" (accessibility.md): short, warm, concrete. Frames the chosen node's
// real data (name / hours) with reassuring i18n copy. This is the static M1
// placeholder for what the Navigator Agent will draft per-node in M2/M3.

import { useTranslation } from "react-i18next";
import { BigButton, Icon } from "../../components/kit";
import type { ResourceNode } from "../../types";

interface ArrivalCardProps {
  node: ResourceNode;
  onDone: () => void;
}

export default function ArrivalCard({ node, onDone }: ArrivalCardProps) {
  const { t } = useTranslation();
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 text-wp-teal2">
        <Icon name="route" size={22} />
        <h2 className="text-lg font-semibold text-wp-tx">
          {t("crisis.arrival.title")}
        </h2>
      </div>

      <p className="text-base font-semibold text-wp-tx">{node.name}</p>

      {node.hours ? (
        <p className="text-sm text-wp-txd">
          <span className="text-wp-txf">{t("crisis.arrival.hours")} </span>
          {node.hours}
        </p>
      ) : null}

      <ul className="flex list-none flex-col gap-2 text-sm text-wp-txd">
        <li>• {t("crisis.arrival.point1")}</li>
        <li>• {t("crisis.arrival.point2")}</li>
        <li>• {t("crisis.arrival.point3")}</li>
      </ul>

      <p className="rounded-[12px] border border-[rgba(47,109,246,0.2)] bg-[rgba(47,109,246,0.07)] p-3 text-sm text-wp-txd">
        {t("crisis.arrival.reassure")}
      </p>

      <BigButton onClick={onDone}>{t("crisis.arrival.done")}</BigButton>
    </div>
  );
}
