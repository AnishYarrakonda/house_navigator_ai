// react-i18next init. English only (the two-mode rebuild dropped Spanish). NO
// user-facing string literals in components — everything goes through these keys
// (see .claude/rules/accessibility.md).

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
