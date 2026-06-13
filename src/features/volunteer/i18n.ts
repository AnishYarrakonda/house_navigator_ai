// Volunteer-side strings. English only (the two-mode rebuild dropped Spanish).
// We register this lane's keys onto the shared i18next instance at import time
// with a deep, non-destructive merge so all user-facing copy still resolves
// through react-i18next keys (see .claude/rules/code-style.md).

import i18n from "../../i18n";

const en = {
  volunteer: {
    title: "Offer a place or resource",
    intro:
      "Describe what you can offer in plain words. We'll turn it into a listing on the map.",
    post: {
      label: "What can you offer?",
      placeholder:
        "e.g. Two spare beds in my place near the Mission, open evenings, dog-friendly.",
      submit: "Post listing",
      posting: "Creating your listing…",
      success: "Your listing is live on the map.",
      error: "Couldn't reach the assistant — posted a basic listing instead.",
      empty: "Write a short description first.",
    },
    type: {
      bed: "Beds",
      food: "Food",
      hygiene: "Hygiene",
      water: "Water",
      medical: "Medical",
      "charging-wifi": "Charging & WiFi",
    },
    mine: {
      title: "Your listings",
      empty: "You haven't posted any listings yet.",
      capacity: "Capacity",
      open: "open",
      of: "of",
      decrease: "Decrease open spots",
      increase: "Increase open spots",
      markFull: "Mark full",
      remove: "Remove",
      removed: "Listing removed.",
      full: "Full",
    },
  },
};

i18n.addResourceBundle("en", "translation", en, true, true);
