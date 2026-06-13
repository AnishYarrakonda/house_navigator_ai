// STUB — Lane 2 (crisis-frontend) builds the no-login crisis flow here:
// one big "I need help" button → large icon need tiles → route + "what to
// expect" card. Icon-first, multilingual, WCAG AA, trauma-informed copy
// (see .claude/rules/accessibility.md).

import { useTranslation } from "react-i18next";

export default function CrisisPanel() {
  const { t } = useTranslation();
  return (
    <div className="rounded-2xl bg-waypoint-surface/90 p-4 text-white shadow-xl backdrop-blur">
      <button
        type="button"
        className="min-h-[44px] w-full rounded-xl bg-waypoint-accent px-6 py-4 text-lg font-semibold text-waypoint-bg"
      >
        {t("crisis.needHelp")}
      </button>
      <p className="mt-3 text-xs text-white/60">{t("crisis.panelStub")}</p>
    </div>
  );
}
