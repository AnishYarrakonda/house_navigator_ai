// MapController context. The public surface (MapProvider, useMapController) is
// FROZEN for the lanes. Internally it now ships a *buffering proxy* instead of a
// no-op stub: panels can call the controller before MapView's real MapLibre
// engine has mounted, and those calls are replayed once Lane 1 registers the
// real controller via `registerMapController`. Panel code never changes.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MapController } from "./types";

// --- The registered real controller + a buffer for early calls -------------
let active: MapController | null = null;
const buffer: Array<(c: MapController) => void> = [];

function dispatch(fn: (c: MapController) => void): void {
  if (active) fn(active);
  else buffer.push(fn);
}

/**
 * A stable controller that forwards to the real one once it registers, and
 * buffers calls made before then. This is what `useMapController` returns until
 * (and after) MapView mounts — the reference never changes, so callers are safe.
 */
const proxyController: MapController = {
  flyTo: (opts) => dispatch((c) => c.flyTo(opts)),
  setZoomLayer: (layer) => dispatch((c) => c.setZoomLayer(layer)),
  highlightNodes: (ids) => dispatch((c) => c.highlightNodes(ids)),
  clearHighlights: () => dispatch((c) => c.clearHighlights()),
  pulseBeacon: (cell) => dispatch((c) => c.pulseBeacon(cell)),
  pickLocation: (cb) => dispatch((c) => c.pickLocation(cb)),
  cancelPick: () => dispatch((c) => c.cancelPick()),
  drawRoute: (id, geo, options) => dispatch((c) => c.drawRoute(id, geo, options)),
  removeRoute: (id) => dispatch((c) => c.removeRoute(id)),
  clearRoutes: () => dispatch((c) => c.clearRoutes()),
  setSelectedRoute: (id) => dispatch((c) => c.setSelectedRoute(id)),
  showHeatmap: (cells) => dispatch((c) => c.showHeatmap(cells)),
  hideHeatmap: () => dispatch((c) => c.hideHeatmap()),
  setTimeScrub: (hour) => dispatch((c) => c.setTimeScrub(hour)),
};

/**
 * Lane 1 (MapView) registers the real controller on mount and clears it (null)
 * on unmount. Buffered early calls are flushed in order on registration.
 */
export function registerMapController(controller: MapController | null): void {
  active = controller;
  if (controller) {
    while (buffer.length) buffer.shift()?.(controller);
  }
}

const MapControllerContext = createContext<MapController | null>(null);

interface MapProviderProps {
  children: ReactNode;
  /** Optional override (e.g. tests); defaults to the buffering proxy. */
  controller?: MapController;
}

export function MapProvider({ children, controller }: MapProviderProps) {
  const value = useMemo(() => controller ?? proxyController, [controller]);
  return (
    <MapControllerContext.Provider value={value}>
      {children}
    </MapControllerContext.Provider>
  );
}

export function useMapController(): MapController {
  const ctx = useContext(MapControllerContext);
  if (!ctx) {
    throw new Error("useMapController must be used within a MapProvider");
  }
  return ctx;
}
