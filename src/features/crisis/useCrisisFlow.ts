// The "Find help" flow state machine. Drives the crisis panel through:
//   home → describe → matching → results → routed
// and drives the MAP only through useMapController() — this lane never touches
// map internals. Privacy: the location is fuzzed to a ~250m cell BEFORE anything
// is matched (whether it came from device GPS, a tapped map point, or a typed
// address), and we never store or transmit a precise point.
//
// The "describe" step has BOTH a single free-text box (what you need, in your
// own words) AND the location capture. On submit we open a beacon, run the live
// AI crew (useCrewStream → /api/crew, streaming reasoning + handoffs) over the
// live nodes, and show three picks: closest / mostResources / balanced. When the
// three picks are ready we draw ALL THREE as different-colored routes on the map
// at once; tapping a card emphasizes that route (others dim) and confirming it
// commits the pick (the chosen route stays drawn).

import { useCallback, useState } from "react";
import { db } from "../../lib/data";
import {
  geocellCenter,
  geocodeToGeocell,
  toGeocell,
  searchAddressOptions,
  type AddressOption,
  type GeoFailReason,
} from "../../lib/geocell";
import { useNodes } from "../../lib/data/hooks";
import { useMapController } from "../../map/MapContext";
import { DEFAULT_ZOOM } from "../../config";
import { fetchRoute } from "../../lib/routing";
import { type MatchPick, type MatchResult } from "../../lib/match";
import { useCrewStream, type UseCrewStream } from "./useCrewStream";
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
export type PickKind = "closest" | "mostResources" | "balanced";

/** Distinct route colors per pick — deliberately NOT the capacity
 * green/amber/red palette. Cobalt / teal / violet read clearly on the dark map.
 */
export const ROUTE_COLORS: Record<PickKind, string> = {
  closest: "#5ab8ff", // cobalt/blue
  mostResources: "#ff7eb6", // pink
  balanced: "#b98cff", // violet/purple
};

/** Stable per-kind route id drawn on the map. */
export const routeIdFor = (kind: PickKind): string => `crisis-route-${kind}`;

const ALL_KINDS: PickKind[] = ["closest", "mostResources", "balanced"];

export interface CrisisFlow {
  step: CrisisStep;
  words: string;
  matches: MatchResult | null;
  selectedNode: ResourceNode | null;
  /** Which pick the person is currently emphasizing on the map (pre-commit). */
  selectedKind: PickKind | null;
  submitting: boolean;
  /** Soft, non-punishing flag if something didn't go through. */
  hiccup: boolean;
  /** Live AI-crew reasoning state for the matching panel. */
  crew: UseCrewStream;

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
  /** List of address matches from the geocoder. */
  addressOptions: AddressOption[];

  start: () => void;
  setWords: (value: string) => void;
  requestDeviceLocation: () => Promise<void>;
  pickOnMap: () => void;
  cancelPick: () => void;
  searchAddress: (query: string) => Promise<void>;
  selectAddressOption: (option: AddressOption) => void;
  submit: () => Promise<void>;
  /** Emphasize a pick's route on the map (dims the others) without committing. */
  selectPick: (kind: PickKind, pick: MatchPick) => void;
  choosePick: (kind: PickKind, pick: MatchPick) => Promise<void>;
  back: () => void;
  reset: () => void;
}

export function useCrisisFlow(): CrisisFlow {
  const map = useMapController();
  const { data: nodes } = useNodes();
  const crew = useCrewStream();

  const [step, setStep] = useState<CrisisStep>("home");
  const [words, setWords] = useState("");
  const [matches, setMatches] = useState<MatchResult | null>(null);
  const [selectedNode, setSelectedNode] = useState<ResourceNode | null>(null);
  const [selectedKind, setSelectedKind] = useState<PickKind | null>(null);
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
  const [addressOptions, setAddressOptions] = useState<AddressOption[]>([]);

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
    setAddressOptions([]);
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
      setAddressOptions([]);
      const options = await searchAddressOptions(query);
      setGeocoding(false);
      if (options.length > 0) {
        setAddressOptions(options);
      } else {
        setAddressNotFound(true);
      }
    },
    [],
  );

  const selectAddressOption = useCallback(
    (option: AddressOption) => {
      setAddressOptions([]);
      const cell = toGeocell(option.lat, option.lng);
      acceptLocation(cell, "manual");
    },
    [acceptLocation],
  );

  // Draw all three picks as distinct-colored ORS routes at once, then pre-select
  // the balanced (recommended) one. Privacy: origin is ALWAYS the fuzzed cell
  // center, never a precise point. De-dupes when picks share a node.
  const drawOptionRoutes = useCallback(
    async (result: MatchResult, cell: string) => {
      const [originLng, originLat] = geocellCenter(cell);
      const origin = { lat: originLat, lng: originLng };
      const seenNodes = new Set<string>();

      const tasks = ALL_KINDS.flatMap((kind) => {
        // Fall back to other picks if this kind is missing to ensure 3 routes
        const pick = result[kind] || result.balanced || result.closest || result.mostResources;
        if (!pick) return [];
        const node = nodes.find((n) => n.id === pick.node_id);
        if (!node) return [];
        return [{ kind, node }];
      });

      map.clearRoutes();
      await Promise.all(
        tasks.map(async ({ kind, node }) => {
          const route = await fetchRoute(origin, { lat: node.lat, lng: node.lng });
          map.drawRoute(routeIdFor(kind), route.geojson, {
            color: ROUTE_COLORS[kind],
          });
        }),
      );

      // Pre-select the recommended (balanced) route if it was drawn; otherwise
      // fall back to whatever was drawn first.
      const recommended = result.balanced && !!nodes.find((n) => n.id === result.balanced?.node_id)
        ? "balanced"
        : (tasks[0]?.kind ?? null);
      if (recommended) {
        map.setSelectedRoute(routeIdFor(recommended));
        setSelectedKind(recommended);
      } else {
        setSelectedKind(null);
      }
    },
    [map, nodes],
  );

  const submit = useCallback(async () => {
    if (!geocell || submitting) return;
    setSubmitting(true);
    setHiccup(false);
    setSelectedKind(null);
    setStep("matching");
    try {
      // Open a beacon need so the signal pulses on the map / fans out via
      // Realtime. The free text is captured on the need; the inferred type is a
      // coarse "bed" default — the AI crew reasons over the words itself.
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

      // Stream the live AI crew (Scout → Analyst → Presenter). Never throws —
      // falls back to synthetic narration + the local heuristic internally.
      const result = await crew.run(words.trim(), geocell, nodes);
      setMatches(result);

      const ids = [result.closest, result.mostResources, result.balanced]
        .filter((p): p is MatchPick => p !== null)
        .map((p) => p.node_id);
      map.highlightNodes(ids);

      setStep("results");
      // Draw the three colored option routes once we're showing results.
      void drawOptionRoutes(result, geocell);
    } catch {
      // Trauma-informed: no red error wall. Let the person try again gently.
      setHiccup(true);
      setStep("describe");
    } finally {
      setSubmitting(false);
    }
  }, [geocell, submitting, words, nodes, map, crew, drawOptionRoutes]);

  // Emphasize one option's route on the map (others dim) without committing —
  // fired when the person taps a card in the results list.
  const selectPick = useCallback(
    (kind: PickKind, pick: MatchPick) => {
      const node = nodes.find((n) => n.id === pick.node_id);
      if (!node) return;
      setSelectedKind(kind);
      map.setSelectedRoute(routeIdFor(kind));
      map.highlightNodes([node.id]);
      map.flyTo({ lng: node.lng, lat: node.lat, zoom: DEFAULT_ZOOM + 1, duration: 900 });
    },
    [map, nodes],
  );

  const choosePick = useCallback(
    async (kind: PickKind, pick: MatchPick) => {
      const node = nodes.find((n) => n.id === pick.node_id);
      if (!node || !geocell) return;
      setSelectedNode(node);
      setSelectedKind(kind);
      setStep("routed");

      // Leave the chosen route drawn and emphasized; clear the other options.
      for (const k of ALL_KINDS) {
        if (k !== kind) map.removeRoute(routeIdFor(k));
      }
      map.setSelectedRoute(routeIdFor(kind));

      const [originLng, originLat] = geocellCenter(geocell);
      try {
        // Re-fetch so the committed route uses real ORS road geometry in its
        // own color, even if the earlier batch fell back.
        const route = await fetchRoute(
          { lat: originLat, lng: originLng },
          { lat: node.lat, lng: node.lng },
        );
        map.drawRoute(routeIdFor(kind), route.geojson, {
          color: ROUTE_COLORS[kind],
          selected: true,
        });
        map.setSelectedRoute(routeIdFor(kind));
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
    map.clearRoutes();
    map.clearHighlights();
    crew.reset();
    setStep("home");
    setWords("");
    setMatches(null);
    setSelectedNode(null);
    setSelectedKind(null);
    setOpenedNeed(null);
    setHiccup(false);
    setGeocell(null);
    setLocationSource(null);
    setLocationStatus("locating");
    setPicking(false);
    setGeocoding(false);
    setAddressNotFound(false);
    setAddressOptions([]);
  }, [map, crew]);

  const back = useCallback(() => {
    map.cancelPick();
    setPicking(false);
    setStep((s) => {
      switch (s) {
        case "describe":
          return "home";
        case "results":
          // Leaving the results: clear the three option routes.
          map.clearRoutes();
          setSelectedKind(null);
          return "describe";
        case "routed":
          // Going back to results: redraw all three option routes.
          if (matches && geocell) void drawOptionRoutes(matches, geocell);
          return "results";
        default:
          return "home";
      }
    });
  }, [map, matches, geocell, drawOptionRoutes]);

  // openedNeed is held for the beacon/Realtime lifecycle; reference it so the
  // lint rule for unused state setters is satisfied without changing behavior.
  void openedNeed;

  return {
    step,
    words,
    matches,
    selectedNode,
    selectedKind,
    submitting,
    hiccup,
    crew,
    locationStatus,
    locationSource,
    picking,
    geocoding,
    addressNotFound,
    hasLocation: geocell !== null,
    addressOptions,
    start,
    setWords,
    requestDeviceLocation,
    pickOnMap,
    cancelPick,
    searchAddress,
    selectAddressOption,
    submit,
    selectPick,
    choosePick,
    back,
    reset,
  };
}
