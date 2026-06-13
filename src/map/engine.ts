// The real MapController implementation (Lane 1). Owns every mutation of the
// MapLibre map: warm-dark basemap, street pins + capacity + beacons, the glowing
// city routes, and the region heatmap. Other lanes drive it ONLY through the
// MapController interface (via MapContext); the extra `set*` methods here are
// fed by MapView from the data hooks.
//
// Privacy: beacons + heatmap geometry come from FUZZED geocell centers only —
// there is never a precise person point (privacy.md invariants #1–#3).

import maplibregl, {
  type ExpressionSpecification,
  type GeoJSONSource,
  type LayerSpecification,
  type Map as MlMap,
} from "maplibre-gl";

import { geocellCenter } from "../lib/geocell";
import type { HeatCell, Need, ResourceNode } from "../types";
import type {
  FlyToOptions,
  LngLat,
  MapController,
  RouteGeoJSON,
  ZoomLayer,
} from "./types";
import type { RouteFeature } from "./routes";
import {
  capacityLevel,
  LEVEL_LABEL,
  ROUTE,
  TYPE_GLYPH,
  TYPE_LABEL,
} from "./visuals";

const TRANSPARENT = "rgba(0, 0, 0, 0)";
const ROUTE_ANIM_MS = 1800;
const BEACON_PERIOD_MS = 1600;

/** Resolve an i18n key with an English fallback (MapView wires this to t()). */
export type LabelFn = (key: string, fallback: string) => string;

/** The map engine: the MapController plus data-sync hooks used by MapView. */
export interface MapEngine extends MapController {
  setNodes(nodes: ResourceNode[], label: LabelFn): void;
  setOpenNeeds(needs: Need[]): void;
  setSeededRoutes(features: RouteFeature[]): void;
  destroy(): void;
}

type Coord = [number, number];

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3);
}

/** A line-gradient that reveals a route up to fraction `p` of its length. */
function revealGradient(color: string, p: number): ExpressionSpecification {
  const edge = Math.min(1, Math.max(0, p));
  let stops: (number | string)[];
  if (edge <= 0) {
    stops = [0, TRANSPARENT, 1, TRANSPARENT];
  } else if (edge >= 0.98) {
    stops = [0, color, 1, color];
  } else {
    stops = [0, color, edge, color, edge + 0.02, TRANSPARENT, 1, TRANSPARENT];
  }
  return [
    "interpolate",
    ["linear"],
    ["line-progress"],
    ...stops,
  ] as unknown as ExpressionSpecification;
}

function classifyZoom(z: number): ZoomLayer {
  if (z >= 13.5) return "street";
  if (z >= 11.3) return "city";
  return "region";
}

const ZOOM_FOR_LAYER: Record<ZoomLayer, number> = {
  street: 14.5,
  city: 12.3,
  region: 10.3,
};

function pointFeature(
  center: Coord,
  properties: Record<string, unknown>,
): GeoJSON.Feature {
  return {
    type: "Feature",
    geometry: { type: "Point", coordinates: center },
    properties,
  };
}

function setSourceData(map: MlMap, id: string, data: GeoJSON.GeoJSON): void {
  const src = map.getSource(id) as GeoJSONSource | undefined;
  src?.setData(data);
}

export function createMapEngine(map: MlMap): MapEngine {
  let ready = false;
  const pending: Array<() => void> = [];
  const run = (fn: () => void) => (ready ? fn() : void pending.push(fn));

  // --- Markers (street pins) ---
  const markers = new Map<string, { marker: maplibregl.Marker; el: HTMLElement }>();
  const highlighted = new Set<string>();

  // --- Routes ---
  const seededRoutes = new Map<string, RouteFeature[]>();
  const externalRoutes = new Map<string, RouteFeature[]>();
  let routeAnimStart = 0;
  let routeAnimActive = false;

  // --- Beacons ---
  const needCells = new Set<string>();
  const manualPulses = new Map<string, number>(); // cell -> expiry timer id

  // --- Manual location pick ---
  let pickHandler: ((e: maplibregl.MapMouseEvent) => void) | null = null;
  function endPick(): void {
    if (pickHandler) {
      map.off("click", pickHandler);
      pickHandler = null;
    }
    map.getContainer().classList.remove("is-picking");
    map.getCanvas().style.cursor = "";
  }

  // --- Heatmap ---
  let scrubHour = -1;

  let raf = 0;

  // ---------------------------------------------------------------- animation
  function applyRouteGradient(p: number): void {
    map.setPaintProperty("route-glow", "line-gradient", revealGradient(ROUTE.doneGlow, p));
    map.setPaintProperty("route-done", "line-gradient", revealGradient(ROUTE.doneCore, p));
  }

  function frame(): void {
    raf = 0;
    const now = performance.now();
    let more = false;

    if (routeAnimActive) {
      const t = Math.min(1, (now - routeAnimStart) / ROUTE_ANIM_MS);
      applyRouteGradient(easeOutCubic(t));
      if (t < 1) more = true;
      else routeAnimActive = false;
    }

    if (needCells.size + manualPulses.size > 0) {
      const phase = (now % BEACON_PERIOD_MS) / BEACON_PERIOD_MS;
      map.setPaintProperty("beacon-pulse", "circle-radius", 4 + phase * 26);
      map.setPaintProperty("beacon-pulse", "circle-opacity", (1 - phase) * 0.5);
      more = true;
    }

    if (more) raf = requestAnimationFrame(frame);
  }

  function ensureLoop(): void {
    if (!raf) raf = requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------- routes
  function rebuildRoutes(): void {
    const byJourney = new Map<string, RouteFeature[]>();
    for (const [id, f] of seededRoutes) byJourney.set(id, f);
    for (const [id, f] of externalRoutes) byJourney.set(id, f); // external wins
    const features = [...byJourney.values()].flat();
    setSourceData(map, "routes", { type: "FeatureCollection", features } as GeoJSON.FeatureCollection);
    routeAnimStart = performance.now();
    routeAnimActive = true;
    ensureLoop();
  }

  // ------------------------------------------------------------------ beacons
  function rebuildBeacons(): void {
    const cells = new Set<string>([...needCells, ...manualPulses.keys()]);
    const features = [...cells].map((cell) =>
      pointFeature(geocellCenter(cell), { cell }),
    );
    setSourceData(map, "beacons", { type: "FeatureCollection", features });
    if (cells.size > 0) ensureLoop();
  }

  // ---------------------------------------------------------------- zoom class
  function applyZoomClass(layer: ZoomLayer): void {
    const c = map.getContainer().classList;
    c.remove("zoom-street", "zoom-city", "zoom-region");
    c.add(`zoom-${layer}`);
  }

  // --------------------------------------------------------------------- init
  function initLayers(): void {
    // Routes (lineMetrics enables the animated line-progress reveal).
    map.addSource("routes", {
      type: "geojson",
      lineMetrics: true,
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "route-glow",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "segment"], "done"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-gradient": revealGradient(ROUTE.doneGlow, 0),
        "line-blur": 6,
        "line-opacity": 0.5,
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 9, 16, 13],
      },
    } as unknown as LayerSpecification);
    map.addLayer({
      id: "route-todo",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "segment"], "todo"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-color": ROUTE.todo,
        "line-opacity": 0.55,
        "line-dasharray": [1.4, 1.6],
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 1.5, 14, 2.5, 16, 3.5],
      },
    } as unknown as LayerSpecification);
    map.addLayer({
      id: "route-done",
      type: "line",
      source: "routes",
      filter: ["==", ["get", "segment"], "done"],
      layout: { "line-cap": "round", "line-join": "round" },
      paint: {
        "line-gradient": revealGradient(ROUTE.doneCore, 0),
        "line-width": ["interpolate", ["linear"], ["zoom"], 10, 2, 14, 3.5, 16, 5],
      },
    } as unknown as LayerSpecification);

    // Beacons (pulse ripple from a FUZZED cell center).
    map.addSource("beacons", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "beacon-pulse",
      type: "circle",
      source: "beacons",
      paint: {
        "circle-radius": 4,
        "circle-color": "#2f6df6",
        "circle-opacity": 0.4,
        "circle-blur": 0.6,
      },
    } as unknown as LayerSpecification);
    map.addLayer({
      id: "beacon-core",
      type: "circle",
      source: "beacons",
      paint: {
        "circle-radius": 5,
        "circle-color": "#5ab8ff",
        "circle-stroke-color": "#2f6df6",
        "circle-stroke-width": 1.5,
      },
    } as unknown as LayerSpecification);

    // Heatmap (region zoom). Hidden until showHeatmap() supplies k-anon cells.
    map.addSource("heat", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "heatmap",
      type: "heatmap",
      source: "heat",
      layout: { visibility: "none" },
      paint: {
        "heatmap-weight": ["interpolate", ["linear"], ["get", "count"], 0, 0, 25, 1],
        "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 8, 1, 11, 2, 13, 3],
        "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 8, 18, 11, 30, 14, 46],
        "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 12, 0.9, 15, 0.4],
        "heatmap-color": [
          "interpolate",
          ["linear"],
          ["heatmap-density"],
          0, TRANSPARENT,
          0.2, "rgba(31, 80, 200, 0.45)",
          0.4, "#1f50c8",
          0.6, "#2f6df6",
          0.8, "#5a8bff",
          1, "#bcd2ff",
        ],
      },
    } as unknown as LayerSpecification);
  }

  // --------------------------------------------------------------- map events
  const onZoom = () => applyZoomClass(classifyZoom(map.getZoom()));

  map.on("load", () => {
    ready = true;
    initLayers();
    applyZoomClass(classifyZoom(map.getZoom()));
    map.on("zoom", onZoom);
    for (const fn of pending) fn();
    pending.length = 0;
  });

  // ----------------------------------------------------- MapController surface
  const engine: MapEngine = {
    flyTo(opts: FlyToOptions) {
      run(() =>
        map.flyTo({
          center: [opts.lng, opts.lat],
          zoom: opts.zoom ?? map.getZoom(),
          duration: opts.duration ?? 1200,
          essential: true,
        }),
      );
    },

    setZoomLayer(layer: ZoomLayer) {
      run(() => {
        map.easeTo({ zoom: ZOOM_FOR_LAYER[layer], duration: 900 });
        applyZoomClass(layer);
      });
    },

    highlightNodes(ids: string[]) {
      run(() => {
        highlighted.clear();
        ids.forEach((id) => highlighted.add(id));
        for (const [id, { el }] of markers) {
          el.classList.toggle("is-highlighted", highlighted.has(id));
        }
        map.getContainer().classList.toggle("has-highlights", ids.length > 0);
      });
    },

    clearHighlights() {
      run(() => {
        highlighted.clear();
        for (const { el } of markers.values()) el.classList.remove("is-highlighted");
        map.getContainer().classList.remove("has-highlights");
      });
    },

    pulseBeacon(geocell: string) {
      run(() => {
        const existing = manualPulses.get(geocell);
        if (existing) window.clearTimeout(existing);
        const timer = window.setTimeout(() => {
          manualPulses.delete(geocell);
          rebuildBeacons();
        }, 9000);
        manualPulses.set(geocell, timer);
        rebuildBeacons();
        // Nudge attention to the area (fuzzed cell center, never a precise point).
        map.flyTo({ center: geocellCenter(geocell), zoom: Math.max(map.getZoom(), 13.5), duration: 1200, essential: true });
      });
    },

    pickLocation(onPick: (point: LngLat) => void) {
      run(() => {
        endPick(); // never stack handlers
        map.getContainer().classList.add("is-picking");
        map.getCanvas().style.cursor = "crosshair";
        const handler = (e: maplibregl.MapMouseEvent) => {
          const { lng, lat } = e.lngLat;
          endPick();
          onPick({ lng, lat });
        };
        pickHandler = handler;
        map.on("click", handler);
      });
    },

    cancelPick() {
      run(() => endPick());
    },

    drawRoute(journeyId: string, geojson: RouteGeoJSON) {
      run(() => {
        externalRoutes.set(journeyId, [
          {
            type: "Feature",
            geometry: geojson.geometry,
            properties: { journeyId, segment: "done" },
          },
        ]);
        rebuildRoutes();
      });
    },

    removeRoute(journeyId: string) {
      run(() => {
        externalRoutes.delete(journeyId);
        seededRoutes.delete(journeyId);
        rebuildRoutes();
      });
    },

    showHeatmap(cells: HeatCell[]) {
      run(() => {
        const features = cells.map((c) =>
          pointFeature(c.center, { count: c.count, type: c.dominant_type ?? "" }),
        );
        setSourceData(map, "heat", { type: "FeatureCollection", features });
        map.setLayoutProperty("heatmap", "visibility", "visible");
      });
    },

    hideHeatmap() {
      run(() => map.setLayoutProperty("heatmap", "visibility", "none"));
    },

    setTimeScrub(hour: number) {
      run(() => {
        scrubHour = hour;
        // Subtle feedback while scrubbing; the coordinator lane re-supplies the
        // k-anon cells for the chosen hour via showHeatmap().
        const warmth = 1 + Math.sin((scrubHour / 24) * Math.PI) * 0.4;
        map.setPaintProperty("heatmap", "heatmap-intensity", [
          "interpolate", ["linear"], ["zoom"], 8, 1 * warmth, 11, 2 * warmth, 13, 3 * warmth,
        ]);
      });
    },

    // --------------------------------------------------- data-sync (MapView)
    setNodes(nodes: ResourceNode[], label: LabelFn) {
      run(() => {
        const seen = new Set<string>();
        for (const node of nodes) {
          seen.add(node.id);
          const level = capacityLevel(node.capacity_open, node.capacity_total);
          const glyph = TYPE_GLYPH[node.type];
          const typeLabel = label(`map.type.${node.type}`, TYPE_LABEL[node.type]);
          const stateLabel = label(`map.capacity.${level}`, LEVEL_LABEL[level]);
          const aria = `${node.name}, ${typeLabel}, ${node.capacity_open} of ${node.capacity_total} — ${stateLabel}`;

          let entry = markers.get(node.id);
          if (!entry) {
            const el = document.createElement("div");
            el.setAttribute("role", "img");
            const marker = new maplibregl.Marker({ element: el, anchor: "center" })
              .setLngLat([node.lng, node.lat])
              .addTo(map);
            entry = { marker, el };
            markers.set(node.id, entry);
          } else {
            entry.marker.setLngLat([node.lng, node.lat]);
          }

          entry.el.className = `wp-pin wp-pin--${level}${highlighted.has(node.id) ? " is-highlighted" : ""}`;
          entry.el.setAttribute("aria-label", aria);
          entry.el.innerHTML = `<span class="wp-pin__badge" aria-hidden="true"><span class="wp-icon">${glyph}</span></span><span class="wp-pin__cap"><span class="wp-pin__num">${node.capacity_open}/${node.capacity_total}</span></span>`;
        }

        // Drop markers for nodes that disappeared.
        for (const [id, { marker }] of markers) {
          if (!seen.has(id)) {
            marker.remove();
            markers.delete(id);
          }
        }
      });
    },

    setOpenNeeds(needs: Need[]) {
      run(() => {
        needCells.clear();
        for (const n of needs) {
          if (n.status === "open") needCells.add(n.fuzzed_geocell);
        }
        rebuildBeacons();
      });
    },

    setSeededRoutes(features: RouteFeature[]) {
      run(() => {
        seededRoutes.clear();
        for (const f of features) {
          const list = seededRoutes.get(f.properties.journeyId) ?? [];
          list.push(f);
          seededRoutes.set(f.properties.journeyId, list);
        }
        rebuildRoutes();
      });
    },

    destroy() {
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      endPick();
      for (const timer of manualPulses.values()) window.clearTimeout(timer);
      manualPulses.clear();
      map.off("zoom", onZoom);
      for (const { marker } of markers.values()) marker.remove();
      markers.clear();
    },
  };

  return engine;
}
