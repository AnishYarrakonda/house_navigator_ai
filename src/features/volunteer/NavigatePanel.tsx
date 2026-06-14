// Volunteer "Navigate to a meetup" flow: search/tap a starting point, pick a
// meetup resource as the destination, get road-snapped route OPTIONS from ORS,
// select one on the map, and run manual turn-by-turn navigation.
//
// Re-implements Pharos's routing/navigation *logic* on Waypoint's own stack
// (MapLibre engine via useMapController + ORS via src/lib/routing) — no Pharos
// code, map, branding, or crime/ML is used. Drives the map ONLY through the
// frozen MapController (drawRoute/setSelectedRoute/clearRoutes/flyTo).

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useMapController } from "../../map";
import { useNodes } from "../../lib/data/hooks";
import { fetchRoutes, type RouteOption } from "../../lib/routing";
import { Button, Card, Icon, SectionLabel, useToast } from "../../components/kit";
import AddressSearch, { type GeoPlace } from "./AddressSearch";
import RouteOptions, { type RouteOptionItem } from "./RouteOptions";
import NavigationView from "./NavigationView";

/** Per-option color, keyed by the tradeoff label (no crime/safety meaning). */
const NAV_COLORS: Record<string, string> = {
  fastest: "#5ab8ff",
  shortest: "#2cb8b4",
  alternative: "#b98cff",
  best: "#5ab8ff",
};

const navRouteId = (i: number): string => `nav-route-${i}`;

/** Classify ORS options by tradeoff so each card has a meaningful label. */
function labelOptions(options: RouteOption[]): string[] {
  if (options.length === 1) return ["best"];
  let fastest = 0;
  let shortest = 0;
  options.forEach((o, i) => {
    if (o.durationSeconds < options[fastest].durationSeconds) fastest = i;
    if (o.distanceMeters < options[shortest].distanceMeters) shortest = i;
  });
  return options.map((_, i) =>
    i === fastest ? "fastest" : i === shortest ? "shortest" : "alternative",
  );
}

/** Center + zoom that frames a route's coordinates. */
function viewFor(coords: [number, number][]): { lat: number; lng: number; zoom: number } {
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity;
  for (const [lng, lat] of coords) {
    minLng = Math.min(minLng, lng);
    maxLng = Math.max(maxLng, lng);
    minLat = Math.min(minLat, lat);
    maxLat = Math.max(maxLat, lat);
  }
  const span = Math.max(maxLat - minLat, maxLng - minLng, 0.005);
  const zoom = Math.min(16, Math.max(11, Math.floor(Math.log2(360 / span)) - 1));
  return { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2, zoom };
}

export default function NavigatePanel() {
  const { t } = useTranslation();
  const map = useMapController();
  const { showToast } = useToast();
  const { data: nodes } = useNodes();

  const [start, setStart] = useState<GeoPlace | null>(null);
  const [pickingStart, setPickingStart] = useState(false);
  const [destId, setDestId] = useState<string>("");
  const [options, setOptions] = useState<RouteOption[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [finding, setFinding] = useState(false);
  const [navigating, setNavigating] = useState(false);

  const dest = useMemo(() => nodes.find((n) => n.id === destId) ?? null, [nodes, destId]);

  const items: RouteOptionItem[] = options.map((o, i) => ({
    id: navRouteId(i),
    kind: kinds[i] ?? "alternative",
    color: NAV_COLORS[kinds[i]] ?? NAV_COLORS.alternative,
    distanceMeters: o.distanceMeters,
    durationSeconds: o.durationSeconds,
  }));

  const pickStartOnMap = () => {
    setPickingStart(true);
    map.pickLocation((p) => {
      setStart({ label: t("volunteer.nav.mapPoint"), lat: p.lat, lng: p.lng });
      setPickingStart(false);
      map.flyTo({ lat: p.lat, lng: p.lng, zoom: 14 });
    });
  };

  const drawAll = (opts: RouteOption[], ks: string[], selectIdx: number) => {
    map.clearRoutes();
    opts.forEach((o, i) => {
      map.drawRoute(navRouteId(i), o.geojson, {
        color: NAV_COLORS[ks[i]] ?? NAV_COLORS.alternative,
      });
    });
    map.setSelectedRoute(navRouteId(selectIdx));
  };

  const findRoutes = async () => {
    if (!start || !dest) {
      showToast(t("volunteer.nav.needBoth"), "info");
      return;
    }
    setFinding(true);
    setNavigating(false);
    try {
      const opts = await fetchRoutes(start, { lat: dest.lat, lng: dest.lng });
      if (opts.length === 0) {
        showToast(t("volunteer.nav.noRoutes"), "info");
        return;
      }
      const ks = labelOptions(opts);
      // Default-select the fastest (or the only) option.
      const fastestIdx = Math.max(0, ks.indexOf("fastest"));
      setOptions(opts);
      setKinds(ks);
      setSelected(fastestIdx);
      drawAll(opts, ks, fastestIdx);
      map.flyTo(viewFor(opts[fastestIdx].geojson.geometry.coordinates));
    } catch {
      showToast(t("volunteer.nav.noRoutes"), "info");
    } finally {
      setFinding(false);
    }
  };

  const selectOption = (id: string) => {
    const idx = items.findIndex((it) => it.id === id);
    if (idx < 0) return;
    setSelected(idx);
    map.setSelectedRoute(id);
  };

  const startNavigation = () => {
    if (selected === null) return;
    // Show only the chosen route while navigating.
    const opt = options[selected];
    map.clearRoutes();
    map.drawRoute(navRouteId(selected), opt.geojson, {
      color: NAV_COLORS[kinds[selected]] ?? NAV_COLORS.best,
      selected: true,
    });
    map.flyTo(viewFor(opt.geojson.geometry.coordinates));
    setNavigating(true);
  };

  const exitNavigation = () => {
    setNavigating(false);
    if (options.length > 0 && selected !== null) drawAll(options, kinds, selected);
  };

  if (navigating && selected !== null) {
    return (
      <NavigationView
        steps={options[selected].steps}
        destinationLabel={dest?.name ?? t("volunteer.nav.destination")}
        onExit={exitNavigation}
      />
    );
  }

  return (
    <Card className="!p-4">
      <SectionLabel>{t("volunteer.nav.title")}</SectionLabel>
      <p className="mb-3 mt-1 text-xs leading-relaxed text-wp-txd">
        {t("volunteer.nav.intro")}
      </p>

      {/* Start */}
      <label className="mb-1.5 block text-[13px] font-semibold text-wp-tx">
        {t("volunteer.nav.startLabel")}
      </label>
      {start ? (
        <div className="mb-2 flex items-center gap-2.5 rounded-[12px] border border-wp-line2 bg-wp-surf2 p-3 text-sm text-wp-tx">
          <Icon name="trip_origin" size={18} className="text-wp-acc" />
          <span className="min-w-0 flex-1 truncate">{start.label}</span>
          <Button variant="ghost" size="sm" onClick={() => setStart(null)} data-no-drag>
            {t("volunteer.nav.change")}
          </Button>
        </div>
      ) : (
        <>
          <AddressSearch
            placeholder={t("volunteer.nav.startPlaceholder")}
            ariaLabel={t("volunteer.nav.startLabel")}
            value={null}
            onPick={setStart}
          />
          {pickingStart ? (
            <div className="mt-2 flex items-center justify-between gap-2 rounded-[12px] border border-wp-line2 bg-wp-surf2 p-2.5 text-[13px] text-wp-txd">
              <span className="flex items-center gap-2">
                <Icon name="touch_app" size={16} className="text-wp-acc2" />
                {t("volunteer.nav.pickingStart")}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setPickingStart(false);
                  map.cancelPick();
                }}
              >
                {t("volunteer.nav.cancel")}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              onClick={pickStartOnMap}
              className="mt-1.5 flex items-center gap-1.5 px-1 text-[12px] text-wp-acc2 hover:underline"
              data-no-drag
            >
              <Icon name="touch_app" size={14} />
              {t("volunteer.nav.useMapTap")}
            </button>
          )}
        </>
      )}

      {/* Destination — a meetup resource */}
      <label
        htmlFor="nav-dest"
        className="mb-1.5 mt-3 block text-[13px] font-semibold text-wp-tx"
      >
        {t("volunteer.nav.destLabel")}
      </label>
      <select
        id="nav-dest"
        value={destId}
        onChange={(e) => setDestId(e.target.value)}
        data-no-drag
        className="min-h-[44px] w-full rounded-[12px] border border-wp-line bg-wp-surf px-3 text-[14px] text-wp-tx focus-visible:border-wp-acc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/40"
      >
        <option value="">{t("volunteer.nav.destPlaceholder")}</option>
        {nodes.map((n) => (
          <option key={n.id} value={n.id}>
            {n.name}
          </option>
        ))}
      </select>

      <Button
        variant="primary"
        size="lg"
        onClick={findRoutes}
        disabled={finding}
        icon={<Icon name={finding ? "progress_activity" : "directions"} size={18} />}
        className="mt-3 min-h-[44px] w-full"
        data-no-drag
      >
        {finding ? t("volunteer.nav.finding") : t("volunteer.nav.findRoutes")}
      </Button>

      {/* Options + start navigation */}
      {options.length > 0 && (
        <div className="mt-4">
          <SectionLabel>{t("volunteer.nav.options")}</SectionLabel>
          <div className="mt-2">
            <RouteOptions
              items={items}
              selectedId={selected !== null ? navRouteId(selected) : null}
              onSelect={selectOption}
            />
          </div>
          <Button
            variant="primary"
            size="lg"
            onClick={startNavigation}
            disabled={selected === null}
            icon={<Icon name="navigation" size={18} fill />}
            className="mt-3 min-h-[44px] w-full"
            data-no-drag
          >
            {t("volunteer.nav.start")}
          </Button>
        </div>
      )}
    </Card>
  );
}
