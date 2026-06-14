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
      locationLabel: "Where is it?",
      pickOnMap: "Tap the location on the map",
      picking: "Tap your spot on the map…",
      cancel: "Cancel",
      locationSet: "Location set",
      changeLocation: "Change",
      needLocation: "Tap the location on the map first.",
      label: "What can you offer?",
      placeholder:
        "e.g. Two spare beds in my place near the Mission, open evenings, dog-friendly.",
      submit: "Post listing",
      posting: "Creating your listing…",
      success: "Your listing is live on the map.",
      error: "Couldn't post that — please try again.",
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
    nav: {
      title: "Navigate to a meetup",
      intro:
        "Get walking directions to a meetup place. Search a starting point, choose where you're headed, then pick a route.",
      startLabel: "Starting point",
      startPlaceholder: "Search an address…",
      useMapTap: "Or tap the map to set it",
      pickingStart: "Tap your starting point…",
      mapPoint: "Pinned on map",
      cancel: "Cancel",
      change: "Change",
      destLabel: "Destination",
      destPlaceholder: "Choose a meetup place",
      destination: "the meetup",
      findRoutes: "Find routes",
      finding: "Finding routes…",
      needBoth: "Set a start and a destination first.",
      noRoutes: "Couldn't find a route — try different points.",
      options: "Route options",
      start: "Start navigation",
      kind: {
        fastest: "Fastest",
        shortest: "Shortest",
        alternative: "Alternative",
        best: "Best route",
      },
      navigating: "Navigating",
      to: "To",
      then: "Then",
      eta: "ETA",
      back: "Back",
      next: "Next",
      arrived: "Arrived",
      exit: "Exit",
      step: "Step",
      noSteps: "No turn-by-turn steps for this route.",
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
