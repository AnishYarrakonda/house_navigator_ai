// Need picker — large icon tiles (glyph + localized word). Five needs map to
// the §5 NeedType union. Each tile is a generous tap target via IconTile.

import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconTile } from "../../components/kit";
import type { NeedType } from "../../types";
import {
  BedIcon,
  FoodIcon,
  MedicalIcon,
  ShowerIcon,
  TalkIcon,
} from "./icons";

const NEEDS: { type: NeedType; Icon: (p: { size?: number }) => ReactNode }[] = [
  { type: "bed", Icon: BedIcon },
  { type: "food", Icon: FoodIcon },
  { type: "hygiene", Icon: ShowerIcon },
  { type: "medical", Icon: MedicalIcon },
  { type: "talk", Icon: TalkIcon },
];

interface NeedTilesProps {
  onChoose: (type: NeedType) => void;
}

export default function NeedTiles({ onChoose }: NeedTilesProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-2 gap-3">
      {NEEDS.map(({ type, Icon }) => (
        <IconTile
          key={type}
          icon={<Icon size={36} />}
          label={t(`needs.${type}`)}
          onClick={() => onChoose(type)}
        />
      ))}
    </div>
  );
}
