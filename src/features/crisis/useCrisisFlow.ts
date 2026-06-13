// The "Find help" flow state machine. Drives the crisis panel through:
//   home → describe → matching → results → routed
// and drives the MAP only through useMapController() — this lane never touches
// map internals. Privacy: the location is fuzzed to a ~250m cell BEFORE anything
// is matched (whether it came from device GPS, a tapped map point, or a typed
// address), and we never store or transmit a precise point.
//
// The "describe" step has BOTH a single free-text box (what you need, in your
// own words) AND the location capture. On submit we open a beacon, run the match
// crew (findMatches) over the live nodes, and show three picks: closest /
// bestFit / balanced. Choosing one draws the road route on the map.

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
import { fetchRoute } from "../../lib/routing";
import { findMatches, type MatchPick, type MatchResult } from "../../lib/match";
import type { Need, ResourceNode } from "../../types";
import { getDevicePersonId } from "./session";

export type CrisisStep = "home" | "describe" | "matching" | "results" | "routed";

/** Status of acquiring the person's (fuzzed) location. */
export type LocationStatus =
  | "locating" // a device-GPS attempt is in flight
  | "ready" // we have a fuzzed cell (from GPS, map tap, or address)
  | GeoFailReason; // the GPS attempt failed — manual fallback offered

export type LocationSource = "gps" | "manual";

/** Which of the three picks the person tapped (for highlight styling). */
export type PickKind = "closest" | "bestFit" | "balanced";

export interface CrisisFlow {
  step: CrisisStep;
  words: string;
  matches: MatchResult | null;
  selectedNode: ResourceNode | null;
  submitting: boolean;
  /** Soft, non-punishing flag if something didn't go through. */
  hiccup: boolean;

  // --- Location capture (lives inside the "describe" step) ---
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
  setWords: (value: string) => void;
  requestDeviceLocation: () => Promise<void>;
  pickOnMap: () => void;
  cancelPick: () => void;
  searchAddress: (query: string) => Promise<void>;
  submit: () => Promise<void>;
  choosePick: (kind: PickKind, pick: MatchPick) => Promise<void>;
  back: () => void;
  reset: () => void;
}

const ROUTE_ID = "crisis-route";

export function useCrisisFlow(): CrisisFlow {
  const map = useMapController();
  const { data: nodes } = useNodes();

  const [step, setStep] = useState<CrisisStep>("home");
  const [words, setWords] = useState("");
  const [matches, setMatches] = useState<MatchResult | null>(null);
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

  const start = useCallback(() => {
    setStep("describe");
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

  const submit = useCallback(async () => {
    if (!geocell || submitting) return;
    setSubmitting(true);
    setHiccup(false);
    setStep("matching");
    try {
      // Open a beacon need so the signal pulses on the map / fans out via
      // Realtime. The free text is captured on the need; the inferred type is a
      // coarse "bed" default — the match crew reasons over the words itself.
      const need = await db.openNeed({
        person_id: getDevicePersonId(),
        type: "bed",
        words: words.trim() || undefined,
        fuzzed_geocell: geocell,
      });
      setOpenedNeed(need);

      const [lng, lat] = geocellCenter(geocell);
      map.setZoomLayer("street");
      map.pulseBeacon(geocell);
      map.flyTo({ lng, lat, zoom: DEFAULT_ZOOM + 1, duration: 1200 });

      const result = await findMatches(words.trim(), geocell, nodes);
      setMatches(result);

      const ids = [result.closest, result.bestFit, result.balanced]
        .filter((p): p is MatchPick => p !== null)
        .map((p) => p.node_id);
      map.highlightNodes(ids);

      setStep("results");
    } catch {
      // Trauma-informed: no red error wall. Let the person try again gently.
      setHiccup(true);
      setStep("describe");
    } finally {
      setSubmitting(false);
    }
  }, [geocell, submitting, words, nodes, map]);

  const choosePick = useCallback(
    async (_kind: PickKind, pick: MatchPick) => {
      const node = nodes.find((n) => n.id === pick.node_id);
      if (!node || !geocell) return;
      setSelectedNode(node);
      setStep("routed");

      const [originLng, originLat] = geocellCenter(geocell);
      try {
        const route = await fetchRoute(
          { lat: originLat, lng: originLng },
          { lat: node.lat, lng: node.lng },
        );
        map.drawRoute(ROUTE_ID, route.geojson);
      } catch {
        // fetchRoute already falls back internally; ignore.
      }
      map.highlightNodes([node.id]);
      map.flyTo({ lng: node.lng, lat: node.lat, zoom: DEFAULT_ZOOM + 2, duration: 1200 });
    },
    [map, nodes, geocell],
  );

  const reset = useCallback(() => {
    map.cancelPick();
    map.removeRoute(ROUTE_ID);
    map.clearHighlights();
    setStep("home");
    setWords("");
    setMatches(null);
    setSelectedNode(null);
    setOpenedNeed(null);
    setHiccup(false);
    setGeocell(null);
    setLocationSource(null);
    setLocationStatus("locating");
    setPicking(false);
    setGeocoding(false);
    setAddressNotFound(false);
  }, [map]);

  const back = useCallback(() => {
    map.cancelPick();
    setPicking(false);
    setStep((s) => {
      switch (s) {
        case "describe":
          return "home";
        case "results":
          return "describe";
        case "routed":
          return "results";
        default:
          return "home";
      }
    });
  }, [map]);

  // openedNeed is held for the beacon/Realtime lifecycle; reference it so the
  // lint rule for unused state setters is satisfied without changing behavior.
  void openedNeed;

  return {
    step,
    words,
    matches,
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
    setWords,
    requestDeviceLocation,
    pickOnMap,
    cancelPick,
    searchAddress,
    submit,
    choosePick,
    back,
    reset,
  };
}
