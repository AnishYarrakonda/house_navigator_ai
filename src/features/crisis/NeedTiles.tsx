// Need picker — large icon tiles (glyph + localized word). Five needs map to
// the §5 NeedType union. Each tile is a generous tap target via IconTile.
// Glyphs are Material Symbols (per Navigation Map/components/NeedTile.dc.html).

import { useTranslation } from "react-i18next";
import { Icon, IconTile } from "../../components/kit";
import type { NeedType } from "../../types";

const NEEDS: { type: NeedType; glyph: string }[] = [
  { type: "bed", glyph: "bed" },
  { type: "food", glyph: "restaurant" },
  { type: "hygiene", glyph: "shower" },
  { type: "medical", glyph: "medical_services" },
  { type: "talk", glyph: "forum" },
];

interface NeedTilesProps {
  onChoose: (type: NeedType) => void;
  /** Currently selected need, if any (for visual highlight). */
  selected?: NeedType | null;
}

export default function NeedTiles({ onChoose, selected }: NeedTilesProps) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5">
      {NEEDS.map(({ type, glyph }) => (
        <IconTile
          key={type}
          icon={<Icon name={glyph} size={28} />}
          label={t(`needs.${type}`)}
          onClick={() => onChoose(type)}
          selected={selected === type}
        />
      ))}
    </div>
  );
}
