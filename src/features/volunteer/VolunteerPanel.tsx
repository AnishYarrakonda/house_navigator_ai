// Volunteer side — "post & manage listings".
//
// A volunteer types a plain-English description of housing / resources they can
// offer. An LLM (api/listing.ts) turns it into a ResourceNode, which we save via
// the data layer; it appears live as a map pin. Below, "Your listings" lets them
// adjust capacity, mark a listing full, or remove it.
//
// Mock-first: if /api/listing isn't reachable (e.g. plain `npm run dev` with no
// serverless functions), we fall back to a tiny client-side parser so the flow
// still works offline. Drives the map ONLY through useMapController. All copy
// goes through react-i18next.

import { useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import "./i18n";
import { db } from "../../lib/data";
import { useNodes } from "../../lib/data/hooks";
import { useMapController } from "../../map";
import type { ResourceNode, ResourceType } from "../../types";
import { SF_CENTER } from "../../config";
import {
  Button,
  Card,
  Icon,
  SectionLabel,
  Skeleton,
  useToast,
} from "../../components/kit";

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

/** Tiny offline parser used when the serverless function isn't reachable. */
function clientParse(text: string): ListingResponse {
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
  const jitter = () => (Math.random() - 0.5) * 0.02;
  return {
    name: firstLine || "Volunteer listing",
    type,
    capacity_total: capacity,
    capacity_open: capacity,
    notes: text.trim().slice(0, 160),
    lat: SF_CENTER.lat + jitter(),
    lng: SF_CENTER.lng + jitter(),
  };
}

async function parseListing(text: string): Promise<ListingResponse> {
  try {
    const res = await fetch("/api/listing", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) throw new Error(`Listing API ${res.status}`);
    const data = (await res.json()) as ListingResponse;
    if (!data || typeof data.lat !== "number") throw new Error("Bad response");
    return data;
  } catch {
    // Offline / no functions → still produce a usable listing.
    return clientParse(text);
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

  const myListings = useMemo(
    () => nodes.filter((n) => n.volunteer_id === CURRENT_VOLUNTEER.id),
    [nodes],
  );

  const submit = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) {
      if (!trimmed) showToast(t("volunteer.post.empty"), "info");
      return;
    }
    setPosting(true);
    try {
      const listing = await parseListing(trimmed);
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
      showToast(t("volunteer.post.success"), "success");
      map.flyTo({ lat: created.lat, lng: created.lng, zoom: 15 });
      map.highlightNodes([created.id]);
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
    <div className="flex h-full flex-col gap-3 overflow-y-auto rounded-[18px] border border-wp-line2 bg-[rgba(14,15,18,0.87)] p-4 text-wp-tx shadow-wp-lg backdrop-blur-[22px]">
      {/* Post a listing */}
      <div>
        <h2 className="font-serif text-lg leading-tight text-wp-tx">
          {t("volunteer.title")}
        </h2>
        <p className="mt-1 text-xs leading-relaxed text-wp-txd">
          {t("volunteer.intro")}
        </p>
      </div>

      <Card className="!p-4">
        <label
          htmlFor="vol-listing-text"
          className="mb-2 block text-[13px] font-semibold text-wp-tx"
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
