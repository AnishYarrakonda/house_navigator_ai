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
      empty: "No open needs right now — it's quiet. We'll light up the moment someone reaches out.",
      loading: "Listening for needs…",
      nearLandmark: "A few blocks from {{place}}",
      away: "~{{dist}} away",
      freshNew: "Just now",
      freshHours: "{{hours}}h left",
      accept: "Accept & help",
      back: "Back to inbound",
    },
    triage: {
      title: "Suggested places",
      recommendedBadge: "Recommended",
      rationaleLabel: "Why",
      openCount: "{{open}} open",
      full: "Full — call first",
      confirm: "Confirm",
      held: "Held",
      confirmedNote: "A spot is being held — and the count just dropped.",
      escalated: "Low confidence — sent to a human to call around. Nothing auto-decided.",
      hint: "These are suggestions. You confirm — nothing happens to anyone until you do.",
      toast: "A spot is held — the live count just dropped.",
    },
    thread: {
      title: "Private thread",
      placeholder: "Send a message…",
      send: "Send",
      systemConfirmed: "{{place}} is holding a spot — they're expecting you.",
      greeting: "Hi — I'm {{name}}, your co-pilot. I'm going to help you find somewhere safe tonight.",
      reassure: "You're all set for tonight. I'll check in tomorrow — you're not doing this alone.",
    },
    journeys: {
      title: "Walking alongside",
      empty: "No active journeys yet — when someone you accept needs a path home, it grows here.",
      loading: "Loading journeys…",
      pathHome: "Path home",
      sharedOn: "Journey shared with you",
      revoke: "Hide",
      restore: "Show journey",
      revoked: "This person paused journey sharing. You can still message them.",
      markNext: "Mark done",
      addStep: "Add step",
      addStepPrompt: "Next step",
      open: "Open",
      complete: "Path complete — remarkable.",
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
      empty: "No hay necesidades abiertas ahora — está tranquilo. Se encenderá en cuanto alguien pida ayuda.",
      loading: "Atentos a las necesidades…",
      nearLandmark: "A pocas cuadras de {{place}}",
      away: "~{{dist}} de distancia",
      freshNew: "Ahora mismo",
      freshHours: "quedan {{hours}}h",
      accept: "Aceptar y ayudar",
      back: "Volver a entrantes",
    },
    triage: {
      title: "Lugares sugeridos",
      recommendedBadge: "Recomendado",
      rationaleLabel: "Por qué",
      openCount: "{{open}} libres",
      full: "Lleno — llama primero",
      confirm: "Confirmar",
      held: "Reservado",
      confirmedNote: "Se está reservando un lugar — y el conteo acaba de bajar.",
      escalated: "Baja confianza — enviado a una persona para gestionarlo. Nada se decidió solo.",
      hint: "Son sugerencias. Tú confirmas — nada ocurre con nadie hasta que lo hagas.",
      toast: "Lugar reservado — el conteo en vivo acaba de bajar.",
    },
    thread: {
      title: "Conversación privada",
      placeholder: "Envía un mensaje…",
      send: "Enviar",
      systemConfirmed: "{{place}} está reservando un lugar — te esperan.",
      greeting: "Hola — soy {{name}}, tu copiloto. Voy a ayudarte a encontrar un lugar seguro esta noche.",
      reassure: "Todo listo por esta noche. Te escribiré mañana — no estás solo en esto.",
    },
    journeys: {
      title: "Acompañando",
      empty: "Aún no hay recorridos activos — cuando alguien que aceptes necesite un camino a casa, crecerá aquí.",
      loading: "Cargando recorridos…",
      pathHome: "Camino a casa",
      sharedOn: "Recorrido compartido contigo",
      revoke: "Ocultar",
      restore: "Mostrar recorrido",
      revoked: "Esta persona pausó el compartir su recorrido. Aún puedes escribirle.",
      markNext: "Marcar hecho",
      addStep: "Agregar paso",
      addStepPrompt: "Siguiente paso",
      open: "Abrir",
      complete: "Camino completo — admirable.",
    },
  },
};

i18n.addResourceBundle("en", "translation", en, true, true);
i18n.addResourceBundle("es", "translation", es, true, true);
