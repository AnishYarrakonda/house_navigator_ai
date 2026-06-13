// Coordinator-view strings, registered onto the shared i18next instance at
// import time (deep, non-destructive merge) so we never edit Lane 2's *.json.
// All coordinator copy resolves through react-i18next keys.

import i18n from "../../i18n";

const en = {
  coordinator: {
    title: "Region view",
    live: "Live",
    kanonNote:
      "Aggregated & anonymized. Areas with fewer than 5 signals are never shown.",
    privacy: {
      lead: "Cells with fewer than",
      kLabel: "k={{k}}",
      tail: "signals are never shown. No precise location is stored or displayed.",
    },
    stats: {
      openBeds: "open beds tonight",
      activeJourneys: "active journeys",
      copilotsOnline: "co-pilots online",
      nearCapacity: "nodes near capacity",
      demo: "demo",
    },
    concentration: {
      title: "Need concentration",
      tenderloin: "Tenderloin",
      mission: "Mission",
      soma: "SoMa",
    },
    heatmap: {
      title: "Where need is concentrating",
      empty: "No area currently meets the privacy threshold to display.",
    },
    scrubber: {
      label: "Time of day",
      hour: "{{hour}}:00",
      play: "Play day",
      pause: "Pause",
      tickMorning: "6 AM",
      tickNoon: "12 PM",
      tickEvening: "6 PM",
      tickMidnight: "12 AM",
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
      positioned: "Pre-positioned",
    },
  },
};

const es = {
  coordinator: {
    title: "Vista de región",
    live: "En vivo",
    kanonNote:
      "Agregado y anonimizado. Las áreas con menos de 5 señales nunca se muestran.",
    privacy: {
      lead: "Las celdas con menos de",
      kLabel: "k={{k}}",
      tail: "señales nunca se muestran. No se almacena ni se muestra una ubicación precisa.",
    },
    stats: {
      openBeds: "camas libres esta noche",
      activeJourneys: "trayectos activos",
      copilotsOnline: "copilotos en línea",
      nearCapacity: "nodos casi llenos",
      demo: "demo",
    },
    concentration: {
      title: "Concentración de necesidad",
      tenderloin: "Tenderloin",
      mission: "Mission",
      soma: "SoMa",
    },
    heatmap: {
      title: "Dónde se concentra la necesidad",
      empty: "Ningún área cumple ahora el umbral de privacidad para mostrarse.",
    },
    scrubber: {
      label: "Hora del día",
      hour: "{{hour}}:00",
      play: "Reproducir día",
      pause: "Pausar",
      tickMorning: "6 a. m.",
      tickNoon: "12 p. m.",
      tickEvening: "6 p. m.",
      tickMidnight: "12 a. m.",
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
      positioned: "Pre-posicionado",
    },
  },
};

i18n.addResourceBundle("en", "translation", en, true, true);
i18n.addResourceBundle("es", "translation", es, true, true);
