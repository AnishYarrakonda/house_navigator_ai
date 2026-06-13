// Coordinator-view strings, registered onto the shared i18next instance at
// import time (deep, non-destructive merge) so we never edit Lane 2's *.json.
// All coordinator copy resolves through react-i18next keys.

import i18n from "../../i18n";

const en = {
  coordinator: {
    title: "District overview",
    kanonNote:
      "Aggregated & anonymized. Areas with fewer than 5 signals are never shown.",
    heatmap: {
      title: "Where need is concentrating",
      empty: "No area currently meets the privacy threshold to display.",
    },
    scrubber: {
      label: "Time of day",
      hour: "{{hour}}:00",
      play: "Play day",
      pause: "Pause",
    },
    capacity: {
      title: "Capacity",
      open: "{{open}} / {{total}} open",
      state: { open: "Open", limited: "Limited", full: "Full" },
      localNote: "Adjustments here are local to this view (demo).",
    },
    alerts: {
      title: "Foresight alerts",
      empty: "No active overflow alerts.",
      severity: { watch: "Watch", warning: "Warning" },
      prePosition: "Pre-position resource",
      positioned: "Pre-positioned ✓",
    },
  },
};

const es = {
  coordinator: {
    title: "Resumen por distrito",
    kanonNote:
      "Agregado y anonimizado. Las áreas con menos de 5 señales nunca se muestran.",
    heatmap: {
      title: "Dónde se concentra la necesidad",
      empty: "Ningún área cumple ahora el umbral de privacidad para mostrarse.",
    },
    scrubber: {
      label: "Hora del día",
      hour: "{{hour}}:00",
      play: "Reproducir día",
      pause: "Pausar",
    },
    capacity: {
      title: "Capacidad",
      open: "{{open}} / {{total}} libres",
      state: { open: "Libre", limited: "Limitada", full: "Llena" },
      localNote: "Los ajustes aquí son locales a esta vista (demo).",
    },
    alerts: {
      title: "Alertas de previsión",
      empty: "No hay alertas de saturación activas.",
      severity: { watch: "Vigilancia", warning: "Advertencia" },
      prePosition: "Pre-posicionar recurso",
      positioned: "Pre-posicionado ✓",
    },
  },
};

i18n.addResourceBundle("en", "translation", en, true, true);
i18n.addResourceBundle("es", "translation", es, true, true);
