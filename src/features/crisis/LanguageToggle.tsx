// Language switch — multilingual from the FIRST screen, not buried in settings
// (accessibility.md). Flips react-i18next between English and Spanish for the
// whole app. The two labels are language autonyms ("English" / "Español"): they
// are intentionally the same in either language, so they live here as constants
// rather than translatable copy. The control's accessible name is i18n'd.

import { useTranslation } from "react-i18next";
import { GlobeIcon } from "./icons";

const LANGS = [
  { code: "en", autonym: "English" },
  { code: "es", autonym: "Español" },
] as const;

export default function LanguageToggle() {
  const { t, i18n } = useTranslation();
  const current = i18n.language.startsWith("es") ? "es" : "en";

  return (
    <div
      className="flex items-center gap-1 rounded-full bg-white/10 p-1"
      role="group"
      aria-label={t("crisis.lang.label")}
    >
      <GlobeIcon size={16} />
      {LANGS.map(({ code, autonym }) => (
        <button
          key={code}
          type="button"
          onClick={() => void i18n.changeLanguage(code)}
          aria-pressed={current === code}
          className={
            "min-h-[36px] rounded-full px-3 text-sm font-semibold transition " +
            "focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-waypoint-accent/60 " +
            (current === code
              ? "bg-waypoint-accent text-waypoint-bg"
              : "text-white/70 hover:text-white")
          }
        >
          {autonym}
        </button>
      ))}
    </div>
  );
}
