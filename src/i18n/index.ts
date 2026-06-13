// react-i18next init. English + Spanish ship for the demo. NO user-facing
// string literals in components — everything goes through these keys
// (see .claude/rules/accessibility.md). Lane 2 owns this folder and expands
// the dictionaries.

import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import en from "./en.json";
import es from "./es.json";

void i18n.use(initReactI18next).init({
  resources: {
    en: { translation: en },
    es: { translation: es },
  },
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;
