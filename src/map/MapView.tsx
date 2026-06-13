// The real full-bleed MapLibre map (Lane 1) — the home screen on every side.
// Mounts the warm-dark SF basemap, builds the real MapController, registers it
// so crisis/volunteer/coordinator calls actually move the map, and feeds it the
// live data hooks (nodes → pins, open needs → beacons, journeys → glowing
// routes). See .claude/rules/map.md.

import { useEffect, useRef } from "react";
import { useTranslation } from "react-i18next";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import "./map.css";

import { DEFAULT_ZOOM, SF_CENTER } from "../config";
import { useJourneys, useNeeds, useNodes } from "../lib/data/hooks";
import { registerMapController } from "./MapContext";
import { warmDarkStyle } from "./style";
import { createMapEngine, type MapEngine } from "./engine";
import { buildJourneyRoutes } from "./routes";

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

  // Auto-draw the seeded journeys so the hero shot lights up on load.
  useEffect(() => {
    let cancelled = false;
    buildJourneyRoutes(journeys, nodes).then((features) => {
      if (!cancelled) engineRef.current?.setSeededRoutes(features);
    });
    return () => {
      cancelled = true;
    };
  }, [journeys, nodes]);

  return <div ref={containerRef} className="absolute inset-0" aria-label="map" />;
}
