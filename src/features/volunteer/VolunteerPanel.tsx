// Volunteer side — "offer a place / resources".
//
// Mirror of the person side: the volunteer first TAPS THEIR LOCATION on the map
// (where their house / the resources are), then types a plain-English
// description of what they can offer. An LLM (api/listing.ts) turns the text
// into a ResourceNode; we save it AT THE TAPPED POINT via the data layer; it
// appears live as a map pin. Below, "Your listings" lets them adjust capacity,
// mark a listing full, or remove it.
//
// Unlike the person side, a volunteer's location is a PUBLIC resource location
// (a place that offers help), not a vulnerable person — so we store its exact
// point on purpose. Mock-first: if /api/listing isn't reachable we fall back to
// a tiny client-side parser. Drives the map ONLY through useMapController.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { db } from "../../lib/data";
import { useNodes } from "../../lib/data/hooks";
import { useMapController } from "../../map";
import type { ResourceNode, ResourceType } from "../../types";
import {
  Button,
  Card,
  Icon,
  SectionLabel,
  Skeleton,
  useToast,
} from "../../components/kit";
import NavigatePanel from "./NavigatePanel";

/** The signed-in volunteer for the demo (no auth — see lib/useRole). */
const CURRENT_VOLUNTEER = { id: "vol-amara", name: "Amara" } as const;

/** Material Symbols glyph per resource type — paired with a label, never alone. */
const TYPE_ICON: Record<ResourceType, string> = {
  bed: "night_shelter",
  food: "restaurant",
  hygiene: "shower",
  water: "water_drop",
  medical: "medical_services",
  "charging-wifi": "wifi",
};

/** What api/listing.ts returns. */
interface ListingResponse {
  name: string;
  type: ResourceType;
  capacity_total: number;
  capacity_open: number;
  hours?: string;
  notes?: string;
  address?: string;
  lat: number;
  lng: number;
}

/** Keyword → type, for the offline fallback parser. */
const KEYWORDS: Array<[ResourceType, string[]]> = [
  ["bed", ["bed", "room", "sleep", "shelter", "couch", "stay", "house", "host"]],
  ["food", ["food", "meal", "grocer", "pantry", "eat", "dinner", "lunch"]],
  ["hygiene", ["shower", "bath", "restroom", "toilet", "laundry", "hygiene", "wash"]],
  ["water", ["water", "drink"]],
  ["medical", ["medic", "clinic", "doctor", "nurse", "first aid", "health"]],
  ["charging-wifi", ["charg", "wifi", "wi-fi", "internet", "outlet"]],
];

/** Tiny offline parser used when the serverless function isn't reachable. The
 *  location comes from the tapped point passed in, NOT from geocoding. */
function clientParse(text: string, at: { lat: number; lng: number }): ListingResponse {
  const lower = text.toLowerCase();
  let type: ResourceType = "bed";
  for (const [t, words] of KEYWORDS) {
    if (words.some((w) => lower.includes(w))) {
      type = t;
      break;
    }
  }
  const numMatch = lower.match(/(\d+)/);
  const capacity = numMatch ? Math.max(1, parseInt(numMatch[1], 10)) : 1;
  const firstLine = text.trim().split(/[.\n]/)[0].slice(0, 60);
  return {
    name: firstLine || "Volunteer listing",
    type,
    capacity_total: capacity,
    capacity_open: capacity,
    notes: text.trim().slice(0, 160),
    lat: at.lat,
    lng: at.lng,
  };
}

async function parseListing(
  text: string,
  at: { lat: number; lng: number },
): Promise<ListingResponse> {
  try {
    const res = await fetch("/api/listing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      // Pass the tapped point so the LLM doesn't have to geocode an address.
      body: JSON.stringify({ text, lat: at.lat, lng: at.lng }),
    });
    if (!res.ok) throw new Error(`Listing API ${res.status}`);
    const data = (await res.json()) as ListingResponse;
    if (!data || typeof data.lat !== "number") throw new Error("Bad response");
    // Always honor the volunteer's tapped location over any geocode.
    return { ...data, lat: at.lat, lng: at.lng };
  } catch {
    return clientParse(text, at);
  }
}

function capacityTone(node: ResourceNode): "open" | "filling" | "full" {
  if (node.capacity_open <= 0) return "full";
  if (node.capacity_total > 0 && node.capacity_open / node.capacity_total <= 0.34)
    return "filling";
  return "open";
}

export default function VolunteerPanel() {
  const { t } = useTranslation();
  const map = useMapController();
  const { showToast } = useToast();
  const { data: nodes, loading } = useNodes();

  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [picking, setPicking] = useState(false);
  const [point, setPoint] = useState<{ lat: number; lng: number } | null>(null);

  const myListings = useMemo(
    () => nodes.filter((n) => n.volunteer_id === CURRENT_VOLUNTEER.id),
    [nodes],
  );

  const pickOnMap = () => {
    setPicking(true);
    map.pickLocation((p) => {
      setPoint({ lat: p.lat, lng: p.lng });
      setPicking(false);
      map.flyTo({ lat: p.lat, lng: p.lng, zoom: 15 });
    });
  };

  const cancelPick = () => {
    setPicking(false);
    map.cancelPick();
  };

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) {
      if (!trimmed) showToast(t("volunteer.post.empty"), "info");
      return;
    }
    if (!point) {
      showToast(t("volunteer.post.needLocation"), "info");
      return;
    }
    setPosting(true);
    try {
      const listing = await parseListing(trimmed, point);
      const created = await db.createNode({
        name: listing.name,
        type: listing.type,
        lat: listing.lat,
        lng: listing.lng,
        capacity_total: listing.capacity_total,
        capacity_open: listing.capacity_open,
        hours: listing.hours,
        notes: listing.notes,
        address: listing.address,
        volunteer_id: CURRENT_VOLUNTEER.id,
      });
      setText("");
      setPoint(null);
      showToast(t("volunteer.post.success"), "success");
      map.flyTo({ lat: created.lat, lng: created.lng, zoom: 15 });
      map.highlightNodes([created.id]);
    } catch {
      showToast(t("volunteer.post.error"), "info");
    } finally {
      setPosting(false);
    }
  };

  const adjustOpen = (node: ResourceNode, delta: number) => {
    const next = Math.max(0, Math.min(node.capacity_total, node.capacity_open + delta));
    if (next === node.capacity_open) return;
    void db.updateNode(node.id, { capacity_open: next });
  };

  const markFull = (node: ResourceNode) => {
    if (node.capacity_open === 0) return;
    void db.updateNode(node.id, { capacity_open: 0 });
  };

  const remove = (node: ResourceNode) => {
    void db.removeNode(node.id);
    showToast(t("volunteer.mine.removed"), "info");
  };

  return (
    <div className="flex flex-col gap-3 text-wp-tx">
      <p className="text-xs leading-relaxed text-wp-txd">{t("volunteer.intro")}</p>

      <Card className="!p-4">
        {/* Step 1 — tap the location of the place / resources */}
        <SectionLabel>{t("volunteer.post.locationLabel")}</SectionLabel>
        {point ? (
          <div className="mt-2 flex items-center gap-2.5 rounded-[12px] border border-[rgba(76,195,138,0.32)] bg-[rgba(76,195,138,0.1)] p-3 text-sm text-[#7ad6a6]">
            <Icon name="check_circle" size={20} fill />
            <span className="flex-1">{t("volunteer.post.locationSet")}</span>
            <Button variant="ghost" size="sm" onClick={pickOnMap} data-no-drag>
              {t("volunteer.post.changeLocation")}
            </Button>
          </div>
        ) : picking ? (
          <div className="mt-2 flex items-center justify-between gap-2 rounded-[12px] border border-wp-line2 bg-wp-surf2 p-3 text-sm text-wp-txd">
            <span className="flex items-center gap-2">
              <Icon name="touch_app" size={18} className="text-wp-acc2" />
              {t("volunteer.post.picking")}
            </span>
            <Button variant="ghost" size="sm" onClick={cancelPick}>
              {t("volunteer.post.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="secondary"
            onClick={pickOnMap}
            icon={<Icon name="add_location_alt" size={18} />}
            className="mt-2 w-full"
          >
            {t("volunteer.post.pickOnMap")}
          </Button>
        )}

        {/* Step 2 — describe what you can offer */}
        <label
          htmlFor="vol-listing-text"
          className="mb-2 mt-4 block text-[13px] font-semibold text-wp-tx"
        >
          {t("volunteer.post.label")}
        </label>
        <textarea
          id="vol-listing-text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={t("volunteer.post.placeholder")}
          rows={4}
          className="w-full resize-none rounded-[12px] border border-wp-line bg-wp-surf px-3 py-2.5 text-[14px] leading-relaxed text-wp-tx placeholder:text-wp-txf focus-visible:border-wp-acc focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-wp-acc/40"
        />
        <Button
          variant="primary"
          size="lg"
          onClick={submit}
          disabled={posting}
          icon={<Icon name={posting ? "hourglass_top" : "add_location_alt"} size={18} />}
          className="mt-3 min-h-[44px] w-full"
        >
          {posting ? t("volunteer.post.posting") : t("volunteer.post.submit")}
        </Button>
      </Card>

      {/* Navigate to a meetup — route options + turn-by-turn */}
      <NavigatePanel />

      {/* My listings */}
      <SectionLabel className="mt-1">{t("volunteer.mine.title")}</SectionLabel>

      {loading ? (
        <>
          <Skeleton className="h-24 rounded-[14px]" />
          <Skeleton className="h-24 rounded-[14px]" />
        </>
      ) : myListings.length === 0 ? (
        <p className="rounded-[14px] border border-wp-line bg-wp-surf px-4 py-3 text-xs leading-relaxed text-wp-txd">
          {t("volunteer.mine.empty")}
        </p>
      ) : (
        myListings.map((node) => {
          const tone = capacityTone(node);
          return (
            <div
              key={node.id}
              className="rounded-[14px] border border-wp-line bg-wp-surf p-3"
            >
              <div className="flex items-start gap-2.5">
                <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-wp-line2 bg-wp-surf3 text-wp-acc2">
                  <Icon name={TYPE_ICON[node.type]} size={20} />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-semibold text-wp-tx">
                    {node.name}
                  </p>
                  <p className="text-[11px] uppercase tracking-wide text-wp-txf">
                    {t(`volunteer.type.${node.type}`)}
                    {node.address ? ` · ${node.address}` : ""}
                  </p>
                  {node.description ? (
                    <p className="truncate text-[11px] italic text-wp-txf">
                      {node.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => remove(node)}
                  aria-label={t("volunteer.mine.remove")}
                  className="flex h-9 min-h-[44px] w-9 min-w-[44px] items-center justify-center rounded-full text-wp-txd hover:bg-wp-surf3 hover:text-[#ef8896]"
                >
                  <Icon name="delete" size={18} />
                </button>
              </div>

              {/* Capacity editor */}
              <div className="mt-3 flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <SectionLabel>{t("volunteer.mine.capacity")}</SectionLabel>
                  <span
                    className={
                      "font-mono text-[13px] font-semibold " +
                      (tone === "full"
                        ? "text-[#ef8896]"
                        : tone === "filling"
                          ? "text-[#e0c878]"
                          : "text-[#79d4a6]")
                    }
                  >
                    {node.capacity_open} {t("volunteer.mine.of")} {node.capacity_total}{" "}
                    {t("volunteer.mine.open")}
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => adjustOpen(node, -1)}
                    aria-label={t("volunteer.mine.decrease")}
                    disabled={node.capacity_open <= 0}
                    className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-[10px] border border-wp-line2 bg-wp-surf3 text-wp-tx hover:bg-wp-surf4 disabled:opacity-40"
                  >
                    <Icon name="remove" size={18} />
                  </button>
                  <button
                    type="button"
                    onClick={() => adjustOpen(node, 1)}
                    aria-label={t("volunteer.mine.increase")}
                    disabled={node.capacity_open >= node.capacity_total}
                    className="flex h-11 min-h-[44px] w-11 min-w-[44px] items-center justify-center rounded-[10px] border border-wp-line2 bg-wp-surf3 text-wp-tx hover:bg-wp-surf4 disabled:opacity-40"
                  >
                    <Icon name="add" size={18} />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 flex gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => markFull(node)}
                  disabled={node.capacity_open === 0}
                  className="min-h-[44px] flex-1"
                >
                  {node.capacity_open === 0
                    ? t("volunteer.mine.full")
                    : t("volunteer.mine.markFull")}
                </Button>
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}
