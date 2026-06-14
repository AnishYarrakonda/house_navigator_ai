// Route-option cards for the volunteer navigation flow — pick among the road-
// snapped alternatives ORS returned. Selecting one emphasizes it on the map
// (the parent calls MapController.setSelectedRoute). Waypoint-native UI.

import { useTranslation } from "react-i18next";
import { Icon } from "../../components/kit";
import { formatDistance, formatDuration } from "./format";

export interface RouteOptionItem {
  id: string;
  /** i18n key suffix under volunteer.nav.kind.* (e.g. "fastest"). */
  kind: string;
  color: string;
  distanceMeters: number;
  durationSeconds: number;
}

interface RouteOptionsProps {
  items: RouteOptionItem[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}

export default function RouteOptions({ items, selectedId, onSelect }: RouteOptionsProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-2" data-no-drag>
      {items.map((item) => {
        const selected = item.id === selectedId;
        return (
          <button
            key={item.id}
            type="button"
            onClick={() => onSelect(item.id)}
            aria-pressed={selected}
            className={
              "flex min-h-[44px] items-center gap-3 rounded-[12px] border p-3 text-left transition-colors " +
              (selected
                ? "border-wp-acc bg-wp-surf2"
                : "border-wp-line bg-wp-surf hover:bg-wp-surf2")
            }
            style={selected ? { borderColor: item.color } : undefined}
          >
            <span
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full"
              style={{ backgroundColor: `${item.color}22`, color: item.color }}
            >
              <Icon name={selected ? "near_me" : "route"} size={18} fill={selected} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[14px] font-semibold text-wp-tx">
                {t(`volunteer.nav.kind.${item.kind}`)}
              </p>
              <p className="text-[12px] text-wp-txd">
                {formatDuration(item.durationSeconds)} · {formatDistance(item.distanceMeters)}
              </p>
            </div>
            {selected && (
              <Icon name="check_circle" size={20} fill className="shrink-0" style={{ color: item.color }} />
            )}
          </button>
        );
      })}
    </div>
  );
}
