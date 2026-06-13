// MapController context. Ships with a NO-OP stub so the app compiles and the
// panels render before Lane 1 lands the real MapLibre controller. Lane 1
// replaces `createStubController` wiring with the real implementation (exposed
// via this same `useMapController` hook) — panel code never changes.

import { createContext, useContext, useMemo, type ReactNode } from "react";
import type { MapController } from "./types";

/** No-op controller — logs in dev so lanes can see calls land, does nothing. */
function createStubController(): MapController {
  const log = (method: string, ...args: unknown[]) => {
    if (import.meta.env.DEV) {
      console.debug(`[map stub] ${method}`, ...args);
    }
  };
  return {
    flyTo: (opts) => log("flyTo", opts),
    setZoomLayer: (layer) => log("setZoomLayer", layer),
    highlightNodes: (ids) => log("highlightNodes", ids),
    clearHighlights: () => log("clearHighlights"),
    pulseBeacon: (cell) => log("pulseBeacon", cell),
    drawRoute: (id, geo) => log("drawRoute", id, geo),
    removeRoute: (id) => log("removeRoute", id),
    showHeatmap: (cells) => log("showHeatmap", cells),
    hideHeatmap: () => log("hideHeatmap"),
    setTimeScrub: (hour) => log("setTimeScrub", hour),
  };
}

const MapControllerContext = createContext<MapController | null>(null);

interface MapProviderProps {
  children: ReactNode;
  /** Lane 1 passes the real controller here; defaults to the no-op stub. */
  controller?: MapController;
}

export function MapProvider({ children, controller }: MapProviderProps) {
  const value = useMemo(
    () => controller ?? createStubController(),
    [controller],
  );
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
