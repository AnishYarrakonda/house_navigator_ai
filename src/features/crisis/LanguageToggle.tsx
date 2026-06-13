// Language switch — multilingual from the FIRST screen, not buried in settings
// (accessibility.md). Flips react-i18next between English and Spanish for the
// whole app. The two labels are language autonyms ("English" / "Español"): they
// are intentionally the same in either language, so they live here as constants
// rather than translatable copy. The control's accessible name is i18n'd.
//
// Rendered as the design system's 2-option pill SegmentedControl.

import { useTranslation } from "react-i18next";
import { Icon, SegmentedControl } from "../../components/kit";
import type { SegmentItem } from "../../components/kit";

type Lang = "en" | "es";

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const current: Lang = i18n.language.startsWith("es") ? "es" : "en";

  const items: SegmentItem<Lang>[] = [
    {
      value: "en",
      label: "English",
      icon: <Icon name="language" size={16} />,
    },
    { value: "es", label: "Español" },
  ];

  return (
    <SegmentedControl
      items={items}
      value={current}
      onChange={(code) => void i18n.changeLanguage(code)}
      pill
      ariaLabel={t("crisis.lang.label")}
    />
  );
}
