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
  RouteStyleOptions,
  ZoomLayer,
} from "./types";
import type { RouteFeature } from "./routes";
import { capacityLevel, ROUTE, TYPE_GLYPH } from "./visuals";

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

/** A zoom-interpolated line-width whose thickness also varies by route state
 * (selected / dim / normal). The zoom `interpolate` MUST be the top-level
 * expression — MapLibre rejects a zoom expression nested inside another
 * expression (e.g. wrapping it in a `*`) — so the per-state multiplier is baked
 * into each interpolation OUTPUT as a `case`, instead of multiplying the whole
 * interpolate by a separate case. */
function emphasizedWidth(
  stops: Array<[number, number]>,
  mul: { selected: number; dim: number; normal: number },
): ExpressionSpecification {
  const out: unknown[] = ["interpolate", ["linear"], ["zoom"]];
  for (const [z, base] of stops) {
    out.push(z, [
      "case",
      ["==", ["get", "selected"], 1], base * mul.selected,
      ["==", ["get", "dim"], 1], base * mul.dim,
      base * mul.normal,
    ]);
  }
  return out as unknown as ExpressionSpecification;
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

  // --- Pins (clustered GL source) ---
  // Base pins are a single clustered GeoJSON source + GL layers (NOT one DOM
  // marker per node). This scales to hundreds of real SF locations without lag,
  // and MapLibre's clustering declutters dense areas like Google Maps: nearby
  // pins collapse into a count bubble that splits apart as you zoom in.
  let highlightedIds: string[] = [];

  // --- Routes ---
  // Seeded journeys flow through the animated `routes` source (single shared
  // reveal gradient). Externally drawn routes (drawRoute) each carry their own
  // color + emphasis state, so they live in a SEPARATE `option-routes` source
  // whose paint is fully data-driven off feature properties — no per-id layers,
  // so an arbitrary number of colored options coexist without layer churn.
  const seededRoutes = new Map<string, RouteFeature[]>();
  let routeAnimStart = 0;
  let routeAnimActive = false;

  // Externally drawn routes: id -> { geometry, color, dim, selected }.
  interface OptionRoute {
    geometry: RouteGeoJSON["geometry"];
    color: string;
    dim: boolean;
    selected: boolean;
  }
  const optionRoutes = new Map<string, OptionRoute>();
  let selectedRouteId: string | null = null;

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
    const features = [...seededRoutes.values()].flat();
    setSourceData(map, "routes", { type: "FeatureCollection", features } as GeoJSON.FeatureCollection);
    routeAnimStart = performance.now();
    routeAnimActive = true;
    ensureLoop();
  }

  /** Re-emit the option-route source from the per-id map. Style is data-driven
   * (color + selected/dim live as feature properties), so a single setData call
   * updates every option at once — cheap enough for old Android. */
  function rebuildOptionRoutes(): void {
    const anySelected = selectedRouteId !== null;
    const features: GeoJSON.Feature[] = [];
    for (const [id, r] of optionRoutes) {
      // An explicit selection wins over per-route flags; with no selection,
      // honor the per-route `selected`/`dim` set at draw time.
      const isSelected = anySelected ? id === selectedRouteId : r.selected;
      const isDim = anySelected ? id !== selectedRouteId : r.dim;
      features.push({
        type: "Feature",
        geometry: r.geometry,
        properties: {
          id,
          color: r.color,
          // Numeric so paint expressions stay simple/cheap.
          selected: isSelected ? 1 : 0,
          dim: isDim ? 1 : 0,
          // Sort key: selected routes render on top of the rest.
          z: isSelected ? 2 : isDim ? 0 : 1,
        },
      });
    }
    setSourceData(map, "option-routes", {
      type: "FeatureCollection",
      features,
    } as GeoJSON.FeatureCollection);
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

  // ------------------------------------------------------------- node icons
  // Generate one white type-glyph image per resource type from the Material
  // Symbols font, on a canvas, then register it so the symbol layer can draw it
  // on top of the colored capacity dot. Degrades gracefully: if the font/canvas
  // isn't ready the colored dot still renders, just without the glyph.
  async function buildTypeIcons(): Promise<void> {
    const fonts = (document as unknown as { fonts?: FontFaceSet }).fonts;
    try {
      await fonts?.load('400 32px "Material Symbols Rounded"');
      await fonts?.ready;
    } catch {
      /* fall through — dots still render */
    }
    const SIZE = 44;
    for (const [type, glyph] of Object.entries(TYPE_GLYPH)) {
      const name = `pin-${type}`;
      if (map.hasImage(name)) continue;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = SIZE;
      const ctx = canvas.getContext("2d");
      if (!ctx) continue;
      ctx.fillStyle = "#ffffff";
      ctx.textAlign = "center";
      ctx.textBaseline = "middle";
      ctx.font = '400 26px "Material Symbols Rounded"';
      ctx.fillText(glyph, SIZE / 2, SIZE / 2 + 1);
      const data = ctx.getImageData(0, 0, SIZE, SIZE);
      if (!map.hasImage(name)) map.addImage(name, data, { pixelRatio: 2 });
    }

    // Cluster glyph: a single white house symbol drawn on every collapsed
    // bubble (no count number — clusters read as "homes here", all identical).
    if (!map.hasImage("pin-cluster")) {
      const CSIZE = 56;
      const canvas = document.createElement("canvas");
      canvas.width = canvas.height = CSIZE;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.fillStyle = "#ffffff";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.font = '400 50px "Material Symbols Rounded"';
        ctx.fillText("home", CSIZE / 2, CSIZE / 2 + 1);
        const data = ctx.getImageData(0, 0, CSIZE, CSIZE);
        if (!map.hasImage("pin-cluster")) map.addImage("pin-cluster", data, { pixelRatio: 2 });
      }
    }

    map.triggerRepaint();
  }

  // Pins are a uniform cobalt blue — the map reads as one clear resource layer.
  // (Capacity open/total is surfaced on the match cards, not encoded by pin
  // color, so there's no green/amber/red here.)
  const PIN_BLUE = "#2f6df6";

  const NONE_FILTER = ["in", ["get", "id"], ["literal", []]] as unknown as ExpressionSpecification;

  function addNodeLayers(): void {
    map.addSource("nodes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
      cluster: true,
      // Cluster only tightly-overlapping pins, and stop clustering a bit sooner,
      // so the ~200 locations read as a full, populated field rather than a
      // handful of fat count-bubbles. They split into individual pins on zoom-in.
      clusterMaxZoom: 12,
      clusterRadius: 18,
    });

    // Highlight ring for matched nodes (under the dot so the dot stays crisp).
    map.addLayer({
      id: "node-highlight-ring",
      type: "circle",
      source: "nodes",
      filter: NONE_FILTER,
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 11, 16, 20],
        "circle-color": "rgba(47,109,246,0.16)",
        "circle-stroke-color": "#5ab8ff",
        "circle-stroke-width": 3,
      },
    } as unknown as LayerSpecification);

    // Unclustered capacity dot.
    map.addLayer({
      id: "node-dot",
      type: "circle",
      source: "nodes",
      filter: ["!", ["has", "point_count"]],
      layout: { visibility: "none" },
      paint: {
        "circle-radius": ["interpolate", ["linear"], ["zoom"], 10, 5, 14, 8, 16, 11],
        "circle-color": PIN_BLUE,
        "circle-stroke-color": "rgba(8,9,10,0.92)",
        "circle-stroke-width": 2,
        "circle-opacity": 0.96,
      },
    } as unknown as LayerSpecification);

    // Type glyph on top of the dot.
    map.addLayer({
      id: "node-icon",
      type: "symbol",
      source: "nodes",
      filter: ["!", ["has", "point_count"]],
      layout: {
        visibility: "none",
        "icon-image": ["concat", "pin-", ["get", "type"]],
        "icon-size": ["interpolate", ["linear"], ["zoom"], 10, 0.32, 14, 0.46, 16, 0.6],
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    } as unknown as LayerSpecification);

    // Cluster bubble — a uniform house badge (no count number). Every collapsed
    // cluster renders identically: same-size teal circle + white house glyph.
    map.addLayer({
      id: "node-cluster",
      type: "circle",
      source: "nodes",
      filter: ["has", "point_count"],
      paint: {
        "circle-color": "rgba(47,109,246,0.82)",
        "circle-stroke-color": "#5ab8ff",
        "circle-stroke-width": 1.5,
        "circle-radius": 18,
      },
    } as unknown as LayerSpecification);
    map.addLayer({
      id: "node-cluster-count",
      type: "symbol",
      source: "nodes",
      filter: ["has", "point_count"],
      layout: {
        "icon-image": "pin-cluster",
        "icon-size": 1.05,
        "icon-allow-overlap": true,
        "icon-ignore-placement": true,
      },
    } as unknown as LayerSpecification);

    // The "capacity pill" — name + open/total — shown ONLY for matched nodes
    // (declutter: never drawn for the whole map, just the few picks).
    map.addLayer({
      id: "node-highlight-label",
      type: "symbol",
      source: "nodes",
      filter: NONE_FILTER,
      layout: {
        "text-field": [
          "concat",
          ["get", "name"],
          "  ",
          ["to-string", ["get", "capOpen"]],
          "/",
          ["to-string", ["get", "capTotal"]],
        ],
        "text-font": ["Open Sans Bold"],
        "text-size": 11,
        "text-offset": [0, 1.5],
        "text-anchor": "top",
        "text-allow-overlap": true,
        "text-max-width": 13,
      },
      paint: {
        "text-color": "#eaf4ff",
        "text-halo-color": "rgba(8,9,10,0.96)",
        "text-halo-width": 1.6,
      },
    } as unknown as LayerSpecification);

    // Cluster interactions: click a bubble to zoom into it.
    map.on("click", "node-cluster", (e) => {
      const feats = map.queryRenderedFeatures(e.point, { layers: ["node-cluster"] });
      const f = feats[0];
      if (!f) return;
      const clusterId = f.properties?.cluster_id as number;
      const src = map.getSource("nodes") as GeoJSONSource;
      void src.getClusterExpansionZoom(clusterId).then((z) => {
        const coords = (f.geometry as GeoJSON.Point).coordinates as [number, number];
        map.easeTo({ center: coords, zoom: z, duration: 600 });
      });
    });
    map.on("mouseenter", "node-cluster", () => {
      map.getCanvas().style.cursor = "pointer";
    });
    map.on("mouseleave", "node-cluster", () => {
      map.getCanvas().style.cursor = "";
    });
  }

  // --------------------------------------------------------------------- init
  function initLayers(): void {
    // Base pins first so routes/beacons draw on top of them.
    addNodeLayers();
    void buildTypeIcons();

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

    // Option routes (drawRoute): an arbitrary number of independently colored
    // routes — the crisis "pick a path" feature. One source, fully data-driven
    // paint keyed off feature properties, so color + selected/dim emphasis are
    // per-feature without per-id layers. `line-sort-key` raises the selected one.
    map.addSource("option-routes", {
      type: "geojson",
      data: { type: "FeatureCollection", features: [] },
    });
    map.addLayer({
      id: "option-route-glow",
      type: "line",
      source: "option-routes",
      layout: {
        "line-cap": "round",
        "line-join": "round",
        "line-sort-key": ["get", "z"],
      },
      paint: {
        "line-color": ["get", "color"],
        "line-blur": 8,
        // Selected glows strongest, dim barely glows, normal in between.
        "line-opacity": [
          "case",
          ["==", ["get", "selected"], 1], 0.55,
          ["==", ["get", "dim"], 1], 0.12,
          0.32,
        ],
        "line-width": emphasizedWidth(
          [[10, 6], [14, 12], [16, 18]],
          { selected: 1.15, dim: 0.55, normal: 0.85 },
        ),
      },
    } as unknown as LayerSpecification);
    // Two core layers split by selection: the SELECTED route draws solid + thick;
    // every other option draws dotted (a shape cue), so the chosen path reads
    // without relying on color/opacity alone (accessibility.md). `line-dasharray`
    // can't be data-driven, hence the split.
    const optionWidth: ExpressionSpecification = emphasizedWidth(
      [[10, 2.5], [14, 4], [16, 6]],
      { selected: 1.3, dim: 0.55, normal: 0.9 },
    );
    const optionOpacity: ExpressionSpecification = [
      "case",
      ["==", ["get", "selected"], 1], 1,
      ["==", ["get", "dim"], 1], 0.45,
      0.85,
    ] as unknown as ExpressionSpecification;
    map.addLayer({
      id: "option-route-core-solid",
      type: "line",
      source: "option-routes",
      filter: ["==", ["get", "selected"], 1],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        "line-sort-key": ["get", "z"],
      },
      paint: {
        "line-color": ["get", "color"],
        "line-opacity": optionOpacity,
        "line-width": optionWidth,
      },
    } as unknown as LayerSpecification);
    map.addLayer({
      id: "option-route-core-dotted",
      type: "line",
      source: "option-routes",
      filter: ["!=", ["get", "selected"], 1],
      layout: {
        "line-cap": "round",
        "line-join": "round",
        "line-sort-key": ["get", "z"],
      },
      paint: {
        "line-color": ["get", "color"],
        "line-opacity": optionOpacity,
        "line-width": optionWidth,
        "line-dasharray": [1.6, 1.6],
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
        highlightedIds = ids;
        const filter = ["in", ["get", "id"], ["literal", ids]] as unknown as ExpressionSpecification;
        map.setFilter("node-highlight-ring", filter);
        map.setFilter("node-highlight-label", filter);
        // Dim the rest so the matched picks stand out (like the old DOM effect).
        map.setPaintProperty("node-dot", "circle-opacity", ids.length > 0 ? 0.32 : 0.96);
        map.setPaintProperty("node-icon", "icon-opacity", ids.length > 0 ? 0.4 : 1);
        map.getContainer().classList.toggle("has-highlights", ids.length > 0);
      });
    },

    clearHighlights() {
      run(() => {
        highlightedIds = [];
        map.setFilter("node-highlight-ring", NONE_FILTER);
        map.setFilter("node-highlight-label", NONE_FILTER);
        map.setPaintProperty("node-dot", "circle-opacity", 0.96);
        map.setPaintProperty("node-icon", "icon-opacity", 1);
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

    drawRoute(id: string, geojson: RouteGeoJSON, options?: RouteStyleOptions) {
      run(() => {
        optionRoutes.set(id, {
          geometry: geojson.geometry,
          // Default to the theme's bright route core when no color is given —
          // a plain 2-arg drawRoute looks like a normal on-theme route.
          color: options?.color ?? ROUTE.doneCore,
          dim: options?.dim ?? false,
          selected: options?.selected ?? false,
        });
        rebuildOptionRoutes();
      });
    },

    removeRoute(id: string) {
      run(() => {
        optionRoutes.delete(id);
        seededRoutes.delete(id);
        if (selectedRouteId === id) selectedRouteId = null;
        rebuildOptionRoutes();
        rebuildRoutes();
      });
    },

    clearRoutes() {
      run(() => {
        optionRoutes.clear();
        selectedRouteId = null;
        rebuildOptionRoutes();
      });
    },

    setSelectedRoute(id: string | null) {
      run(() => {
        selectedRouteId = id;
        rebuildOptionRoutes();
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
        void label; // labels now live in the GL layers' data-driven text
        const features: GeoJSON.Feature[] = nodes.map((node) => ({
          type: "Feature",
          geometry: { type: "Point", coordinates: [node.lng, node.lat] },
          properties: {
            id: node.id,
            type: node.type,
            level: capacityLevel(node.capacity_open, node.capacity_total),
            name: node.name,
            capOpen: node.capacity_open,
            capTotal: node.capacity_total,
          },
        }));
        setSourceData(map, "nodes", {
          type: "FeatureCollection",
          features,
        } as GeoJSON.FeatureCollection);
        // Re-assert highlight filters in case ids were set before data arrived.
        if (highlightedIds.length) this.highlightNodes(highlightedIds);
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
    },
  };

  return engine;
}
