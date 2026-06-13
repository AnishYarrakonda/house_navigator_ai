// Co-pilot side strings. Lane 2 owns src/i18n/*.json; to avoid editing their
// files (and to keep this lane's copy co-located) we register our keys onto the
// shared i18next instance at import time with a deep, non-destructive merge.
// All user-facing strings still resolve through react-i18next keys
// (see .claude/rules/code-style.md + accessibility.md).

import i18n from "../../i18n";

const en = {
  volunteer: {
    tabs: { inbound: "Inbound", journeys: "My journeys" },
    privacyNote: "You see the need and a rough area only — no name, no exact spot, until they accept.",
    needType: {
      bed: "Bed",
      food: "Food",
      hygiene: "Shower",
      medical: "Medical",
      talk: "Someone to talk to",
    },
    inbound: {
      title: "People reaching out",
      empty: "No open needs right now.",
      nearLandmark: "A few blocks from {{place}}",
      away: "~{{dist}} away",
      freshNew: "Just now",
      freshHours: "{{hours}}h left",
      accept: "Accept & help",
      back: "← Back to inbound",
    },
    triage: {
      title: "Suggested places",
      recommendedBadge: "Recommended",
      rationaleLabel: "Why",
      openCount: "{{open}} open",
      full: "Full — call first",
      confirm: "Confirm this place",
      confirmedNote: "Confirmed — a bed was held and the count dropped.",
      escalated: "Low confidence — sent to a human to call around. Nothing auto-decided.",
      hint: "These are suggestions. You confirm — nothing happens to anyone until you do.",
    },
    thread: {
      title: "Private thread",
      placeholder: "Write something reassuring…",
      send: "Send",
      systemConfirmed: "{{place}} is holding a spot — they're expecting you.",
      greeting: "Hi — I'm {{name}}, your co-pilot. I'm going to help you find somewhere safe tonight.",
      reassure: "You're all set for tonight. I'll check in tomorrow — you're not doing this alone.",
    },
    journeys: {
      title: "Walking alongside",
      empty: "No active journeys yet.",
      pathHome: "Path home",
      sharedOn: "Journey shared with you",
      revoke: "Hide journey",
      restore: "Show journey",
      revoked: "This person paused journey sharing. You can still message them.",
      markNext: "Mark current step done",
      addStep: "Add next step",
      addStepPrompt: "Next step",
      open: "Open thread",
    },
  },
};

const es = {
  volunteer: {
    tabs: { inbound: "Entrantes", journeys: "Mis recorridos" },
    privacyNote: "Solo ves la necesidad y una zona aproximada — sin nombre ni lugar exacto, hasta que acepten.",
    needType: {
      bed: "Cama",
      food: "Comida",
      hygiene: "Ducha",
      medical: "Atención médica",
      talk: "Alguien con quien hablar",
    },
    inbound: {
      title: "Personas pidiendo ayuda",
      empty: "No hay necesidades abiertas ahora.",
      nearLandmark: "A pocas cuadras de {{place}}",
      away: "~{{dist}} de distancia",
      freshNew: "Ahora mismo",
      freshHours: "quedan {{hours}}h",
      accept: "Aceptar y ayudar",
      back: "← Volver a entrantes",
    },
    triage: {
      title: "Lugares sugeridos",
      recommendedBadge: "Recomendado",
      rationaleLabel: "Por qué",
      openCount: "{{open}} libres",
      full: "Lleno — llama primero",
      confirm: "Confirmar este lugar",
      confirmedNote: "Confirmado — se reservó una cama y bajó el conteo.",
      escalated: "Baja confianza — enviado a una persona para gestionarlo. Nada se decidió solo.",
      hint: "Son sugerencias. Tú confirmas — nada ocurre con nadie hasta que lo hagas.",
    },
    thread: {
      title: "Conversación privada",
      placeholder: "Escribe algo que tranquilice…",
      send: "Enviar",
      systemConfirmed: "{{place}} está reservando un lugar — te esperan.",
      greeting: "Hola — soy {{name}}, tu copiloto. Voy a ayudarte a encontrar un lugar seguro esta noche.",
      reassure: "Todo listo por esta noche. Te escribiré mañana — no estás solo en esto.",
    },
    journeys: {
      title: "Acompañando",
      empty: "Aún no hay recorridos activos.",
      pathHome: "Camino a casa",
      sharedOn: "Recorrido compartido contigo",
      revoke: "Ocultar recorrido",
      restore: "Mostrar recorrido",
      revoked: "Esta persona pausó el compartir su recorrido. Aún puedes escribirle.",
      markNext: "Marcar paso actual como hecho",
      addStep: "Agregar siguiente paso",
      addStepPrompt: "Siguiente paso",
      open: "Abrir conversación",
    },
  },
};

i18n.addResourceBundle("en", "translation", en, true, true);
i18n.addResourceBundle("es", "translation", es, true, true);
