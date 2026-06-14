// The real full-bleed MapLibre map (Lane 1) — the home screen on both sides.
// Mounts the CARTO vector dark SF basemap, builds the real MapController,
// registers it so the Find-help / Volunteer panels actually move the map, and
// feeds it the live data hooks (nodes → pins, open needs → beacons). Routes are
// drawn on demand (a person's fuzzed area → the resource they pick) via
// MapController.drawRoute. See .claude/rules/map.md.

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import { DEFAULT_ZOOM, SF_CENTER } from "../config";
import { useJourneys, useNeeds, useNodes } from "../lib/data/hooks";
import { registerMapController } from "./MapContext";
import { warmDarkStyle } from "./style";
import { buildJourneyRoutes } from "./routes";
import { createMapEngine, type MapEngine } from "./engine";

export default function MapView() {
  const containerRef = useRef<HTMLDivElement>(null);
  const engineRef = useRef<MapEngine | null>(null);
  const { t } = useTranslation();

  const { data: nodes } = useNodes();
  const { data: needs } = useNeeds();
  const { data: journeys } = useJourneys();

  // Create the map + engine once, and register the real controller.
  useEffect(() => {
    if (!containerRef.current) return;
    const map = new maplibregl.Map({
      container: containerRef.current,
      style: warmDarkStyle,
      center: [SF_CENTER.lng, SF_CENTER.lat],
      zoom: DEFAULT_ZOOM,
      attributionControl: { compact: true },
      // Keep it cheap on old Android (map.md / accessibility.md).
      maxZoom: 17,
      minZoom: 9,
    });
    map.addControl(
      new maplibregl.NavigationControl({ showCompass: false }),
      "bottom-right",
    );

    const engine = createMapEngine(map);
    engineRef.current = engine;
    registerMapController(engine);

    return () => {
      registerMapController(null);
      engine.destroy();
      map.remove();
      engineRef.current = null;
    };
  }, []);

  // Pins + live capacity.
  useEffect(() => {
    engineRef.current?.setNodes(nodes, (key, fallback) =>
      t(key, { defaultValue: fallback }),
    );
  }, [nodes, t]);

  // Beacon ripples from open needs (fuzzed cells only).
  useEffect(() => {
    engineRef.current?.setOpenNeeds(needs);
  }, [needs]);

  // Seeded "path home" journeys — the glowing many-routes reveal. Each journey's
  // done/todo segments are road-snapped (src/map/routes.ts) so they trace real
  // streets, not a straight hop. Origins are synthetic, non-identifying points
  // (privacy.md #1) — there is no real person coordinate anywhere.
  useEffect(() => {
    if (nodes.length === 0 || journeys.length === 0) return;
    let active = true;
    buildJourneyRoutes(journeys, nodes).then((features) => {
      if (active) engineRef.current?.setSeededRoutes(features);
    });
    return () => {
      active = false;
    };
  }, [nodes, journeys]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="map" />;
}
