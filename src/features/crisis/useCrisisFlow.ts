// The *tonight* loop state machine. Drives the crisis panel through:
//   home → needs → words → results → arrival
// and drives the MAP only through useMapController() — this lane never touches
// map internals. Privacy: location is fuzzed (getFuzzedLocation) BEFORE the need
// is opened, and the beacon pulses from that fuzzed cell, never a precise point.

import { useCallback, useState } from "react";
import { db } from "../../lib/data";
import { getFuzzedLocation, geocellCenter } from "../../lib/geocell";
import { useNodes } from "../../lib/data/hooks";
import { useMapController } from "../../map/MapContext";
import { DEFAULT_ZOOM } from "../../config";
import type { Need, NeedType, ResourceNode } from "../../types";
import type { RouteGeoJSON } from "../../map/types";
import { matchNodes, type RankedNode } from "./matching";
import { getDevicePersonId } from "./session";

export type CrisisStep = "home" | "needs" | "words" | "results" | "arrival";

export interface CrisisFlow {
  step: CrisisStep;
  selectedNeed: NeedType | null;
  words: string;
  ranked: RankedNode[];
  selectedNode: ResourceNode | null;
  submitting: boolean;
  /** Soft, non-punishing flag if opening the need didn't go through. */
  hiccup: boolean;

  start: () => void;
  chooseNeed: (type: NeedType) => void;
  setWords: (value: string) => void;
  submitNeed: () => Promise<void>;
  chooseNode: (ranked: RankedNode) => void;
  back: () => void;
  reset: () => void;
}

export function useCrisisFlow(): CrisisFlow {
  const map = useMapController();
  const { data: nodes } = useNodes();

  const [step, setStep] = useState<CrisisStep>("home");
  const [selectedNeed, setSelectedNeed] = useState<NeedType | null>(null);
  const [words, setWords] = useState("");
  const [ranked, setRanked] = useState<RankedNode[]>([]);
  const [selectedNode, setSelectedNode] = useState<ResourceNode | null>(null);
  const [openedNeed, setOpenedNeed] = useState<Need | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [hiccup, setHiccup] = useState(false);

  const start = useCallback(() => setStep("needs"), []);

  const chooseNeed = useCallback((type: NeedType) => {
    setSelectedNeed(type);
    setStep("words");
  }, []);

  const submitNeed = useCallback(async () => {
    if (!selectedNeed || submitting) return;
    setSubmitting(true);
    setHiccup(false);
    try {
      // Fuzz the location BEFORE anything is stored or transmitted.
      const fuzzedGeocell = await getFuzzedLocation();
      const need = await db.openNeed({
        person_id: getDevicePersonId(),
        type: selectedNeed,
        words: words.trim() || undefined,
        fuzzed_geocell: fuzzedGeocell,
      });
      setOpenedNeed(need);

      const matches = matchNodes(selectedNeed, fuzzedGeocell, nodes);
      setRanked(matches);

      // Drive the map: pulse a beacon from the fuzzed cell, light up matches,
      // and ease toward the cell so the person sees help appear around them.
      const [lng, lat] = geocellCenter(fuzzedGeocell);
      map.setZoomLayer("street");
      map.pulseBeacon(fuzzedGeocell);
      map.highlightNodes(matches.map((m) => m.node.id));
      map.flyTo({ lng, lat, zoom: DEFAULT_ZOOM + 1, duration: 1200 });

      setStep("results");
    } catch {
      // Trauma-informed: no red error wall. Let the person try again gently.
      setHiccup(true);
    } finally {
      setSubmitting(false);
    }
  }, [selectedNeed, submitting, words, nodes, map]);

  const chooseNode = useCallback(
    (choice: RankedNode) => {
      const { node } = choice;
      setSelectedNode(node);

      const start = geocellCenter(openedNeed?.fuzzed_geocell ?? "");
      const route: RouteGeoJSON = {
        type: "Feature",
        geometry: {
          type: "LineString",
          coordinates: [start, [node.lng, node.lat]],
        },
        properties: { kind: "crisis", nodeId: node.id },
      };
      map.drawRoute(openedNeed?.id ?? "crisis-route", route);
      map.flyTo({ lng: node.lng, lat: node.lat, zoom: DEFAULT_ZOOM + 2, duration: 1200 });

      setStep("arrival");
    },
    [map, openedNeed],
  );

  const reset = useCallback(() => {
    map.removeRoute(openedNeed?.id ?? "crisis-route");
    map.clearHighlights();
    setStep("home");
    setSelectedNeed(null);
    setWords("");
    setRanked([]);
    setSelectedNode(null);
    setOpenedNeed(null);
    setHiccup(false);
  }, [map, openedNeed]);

  const back = useCallback(() => {
    setStep((s) => {
      switch (s) {
        case "needs":
          return "home";
        case "words":
          return "needs";
        case "results":
          return "words";
        case "arrival":
          return "results";
        default:
          return "home";
      }
    });
  }, []);

  return {
    step,
    selectedNeed,
    words,
    ranked,
    selectedNode,
    submitting,
    hiccup,
    start,
    chooseNeed,
    setWords,
    submitNeed,
    chooseNode,
    back,
    reset,
  };
}
