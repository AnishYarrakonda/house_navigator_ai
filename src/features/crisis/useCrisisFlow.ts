// The *tonight* loop state machine. Drives the crisis panel through:
//   home → needs → words → location → results → arrival
// and drives the MAP only through useMapController() — this lane never touches
// map internals. Privacy: the location is fuzzed to a ~250m cell BEFORE the need
// is opened (whether it came from device GPS, a tapped map point, or a typed
// address), and the beacon pulses from that fuzzed cell, never a precise point.

import { useCallback, useState } from "react";
import { db } from "../../lib/data";
import {
  geocellCenter,
  geocodeToGeocell,
  getCurrentGeocell,
  toGeocell,
  type GeoFailReason,
} from "../../lib/geocell";
import { useNodes } from "../../lib/data/hooks";
import { useMapController } from "../../map/MapContext";
import { DEFAULT_ZOOM } from "../../config";
import type { Need, NeedType, ResourceNode } from "../../types";
import type { RouteGeoJSON } from "../../map/types";
import { matchNodes, type RankedNode } from "./matching";
import { getDevicePersonId } from "./session";

export type CrisisStep = "home" | "needs" | "words" | "location" | "results" | "arrival";

/** Status of acquiring the person's (fuzzed) location. */
export type LocationStatus =
  | "locating" // a device-GPS attempt is in flight
  | "ready" // we have a fuzzed cell (from GPS, map tap, or address)
  | GeoFailReason; // the GPS attempt failed — manual fallback offered

export type LocationSource = "gps" | "manual";

export interface CrisisFlow {
  step: CrisisStep;
  selectedNeed: NeedType | null;
  words: string;
  ranked: RankedNode[];
  selectedNode: ResourceNode | null;
  submitting: boolean;
  /** Soft, non-punishing flag if opening the need didn't go through. */
  hiccup: boolean;

  // --- Location step ---
  locationStatus: LocationStatus;
  locationSource: LocationSource | null;
  /** True while the person is tapping their spot on the map. */
  picking: boolean;
  /** True while a typed address is being looked up. */
  geocoding: boolean;
  /** True if the last address lookup found nothing. */
  addressNotFound: boolean;
  /** True once we have a fuzzed cell and can proceed. */
  hasLocation: boolean;

  start: () => void;
  chooseNeed: (type: NeedType) => void;
  setWords: (value: string) => void;
  goToLocation: () => void;
  requestDeviceLocation: () => Promise<void>;
  pickOnMap: () => void;
  cancelPick: () => void;
  searchAddress: (query: string) => Promise<void>;
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

  // Location state.
  const [geocell, setGeocell] = useState<string | null>(null);
  const [locationStatus, setLocationStatus] = useState<LocationStatus>("locating");
  const [locationSource, setLocationSource] = useState<LocationSource | null>(null);
  const [picking, setPicking] = useState(false);
  const [geocoding, setGeocoding] = useState(false);
  const [addressNotFound, setAddressNotFound] = useState(false);

  const start = useCallback(() => setStep("needs"), []);

  const chooseNeed = useCallback((type: NeedType) => {
    setSelectedNeed(type);
    setStep("words");
  }, []);

  // Confirm a fuzzed cell from any source, and show it on the map.
  const acceptLocation = useCallback(
    (cell: string, source: LocationSource) => {
      setGeocell(cell);
      setLocationSource(source);
      setLocationStatus("ready");
      setAddressNotFound(false);
      const [lng, lat] = geocellCenter(cell);
      map.setZoomLayer("street");
      map.pulseBeacon(cell);
      map.flyTo({ lng, lat, zoom: DEFAULT_ZOOM + 1, duration: 1000 });
    },
    [map],
  );

  // Make exactly one device-GPS attempt (no auto-retry loop).
  const requestDeviceLocation = useCallback(async () => {
    setPicking(false);
    map.cancelPick();
    setLocationStatus("locating");
    const result = await getCurrentGeocell();
    if (result.ok) {
      acceptLocation(result.cell, "gps");
    } else {
      setLocationStatus(result.reason);
    }
  }, [acceptLocation, map]);

  const goToLocation = useCallback(() => {
    setStep("location");
    // Reset and kick off a single GPS attempt when entering the step.
    setGeocell(null);
    setLocationSource(null);
    setAddressNotFound(false);
    void requestDeviceLocation();
  }, [requestDeviceLocation]);

  const pickOnMap = useCallback(() => {
    setPicking(true);
    map.pickLocation((point) => {
      // Fuzz on capture — the precise tapped point is never stored.
      acceptLocation(toGeocell(point.lat, point.lng), "manual");
      setPicking(false);
    });
  }, [acceptLocation, map]);

  const cancelPick = useCallback(() => {
    setPicking(false);
    map.cancelPick();
  }, [map]);

  const searchAddress = useCallback(
    async (query: string) => {
      setGeocoding(true);
      setAddressNotFound(false);
      const cell = await geocodeToGeocell(query);
      setGeocoding(false);
      if (cell) acceptLocation(cell, "manual");
      else setAddressNotFound(true);
    },
    [acceptLocation],
  );

  const submitNeed = useCallback(async () => {
    if (!selectedNeed || !geocell || submitting) return;
    setSubmitting(true);
    setHiccup(false);
    try {
      const need = await db.openNeed({
        person_id: getDevicePersonId(),
        type: selectedNeed,
        words: words.trim() || undefined,
        fuzzed_geocell: geocell,
      });
      setOpenedNeed(need);

      const matches = matchNodes(selectedNeed, geocell, nodes);
      setRanked(matches);

      // Light up matches around the fuzzed cell.
      const [lng, lat] = geocellCenter(geocell);
      map.setZoomLayer("street");
      map.pulseBeacon(geocell);
      map.highlightNodes(matches.map((m) => m.node.id));
      map.flyTo({ lng, lat, zoom: DEFAULT_ZOOM + 1, duration: 1200 });

      setStep("results");
    } catch {
      // Trauma-informed: no red error wall. Let the person try again gently.
      setHiccup(true);
    } finally {
      setSubmitting(false);
    }
  }, [selectedNeed, geocell, submitting, words, nodes, map]);

  const chooseNode = useCallback(
    (choice: RankedNode) => {
      const { node } = choice;
      setSelectedNode(node);

      const start = geocellCenter(openedNeed?.fuzzed_geocell ?? geocell ?? "");
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
    [map, openedNeed, geocell],
  );

  const reset = useCallback(() => {
    map.cancelPick();
    map.removeRoute(openedNeed?.id ?? "crisis-route");
    map.clearHighlights();
    setStep("home");
    setSelectedNeed(null);
    setWords("");
    setRanked([]);
    setSelectedNode(null);
    setOpenedNeed(null);
    setHiccup(false);
    setGeocell(null);
    setLocationSource(null);
    setLocationStatus("locating");
    setPicking(false);
    setGeocoding(false);
    setAddressNotFound(false);
  }, [map, openedNeed]);

  const back = useCallback(() => {
    map.cancelPick();
    setPicking(false);
    setStep((s) => {
      switch (s) {
        case "needs":
          return "home";
        case "words":
          return "needs";
        case "location":
          return "words";
        case "results":
          return "location";
        case "arrival":
          return "results";
        default:
          return "home";
      }
    });
  }, [map]);

  return {
    step,
    selectedNeed,
    words,
    ranked,
    selectedNode,
    submitting,
    hiccup,
    locationStatus,
    locationSource,
    picking,
    geocoding,
    addressNotFound,
    hasLocation: geocell !== null,
    start,
    chooseNeed,
    setWords,
    goToLocation,
    requestDeviceLocation,
    pickOnMap,
    cancelPick,
    searchAddress,
    submitNeed,
    chooseNode,
    back,
    reset,
  };
}
