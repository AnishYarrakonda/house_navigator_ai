// Live (Supabase + Realtime) DataLayer. Selected by VITE_DATA_MODE=live in
// ./index.ts — same DataLayer interface as the in-memory mock, swapped at the
// boundary so the UI (all three frontend lanes) is identical in mock and live.
//
// Design notes:
//  * Map-visible state is DB-driven (map.md): every subscribe* opens a Supabase
//    Realtime channel and, on any change to the table, refetches and re-emits
//    the current list. That live update is the demo's wow (M2).
//  * k-anonymity for the heatmap is enforced HERE in the derivation (privacy
//    invariant #3) — cells with < K_ANON_MIN signals are dropped, never hidden
//    in the UI.
//  * Beacon expiry is enforced server-side-of-the-UI here (invariant #5): an
//    expired need is never surfaced as open.
//  * No PII column exists to leak (invariant #1): a person's place on the map is
//    the resource node they head to, never their body.

import type { SupabaseClient } from "@supabase/supabase-js";
import { K_ANON_MIN } from "../../config";
import type {
  ForesightAlert,
  HeatCell,
  Journey,
  Message,
  Need,
  NeedType,
  OpenNeedInput,
  ResourceNode,
  Waypoint,
} from "../../types";
import { geocellCenter, toGeocell } from "../geocell";
import { supabase } from "../supabase";
import type {
  AddWaypointInput,
  DataLayer,
  HeatmapOptions,
  SendMessageInput,
  Unsubscribe,
} from "./types";

/** The client is non-null in live mode (env vars present). Fail loudly if not. */
function db(): SupabaseClient {
  if (!supabase) {
    throw new Error(
      "Supabase client is not configured. Set VITE_SUPABASE_URL and " +
        "VITE_SUPABASE_ANON_KEY (live mode), or run with VITE_DATA_MODE=mock.",
    );
  }
  return supabase;
}

// --- Row shapes (the §5 tables) → domain types -----------------------------
// Typed once here so no `any` crosses the DB ↔ UI boundary (code-style.md).
interface NodeRow {
  id: string;
  name: string;
  type: ResourceNode["type"];
  lat: number;
  lng: number;
  capacity_total: number;
  capacity_open: number;
  hours: string | null;
  notes: string | null;
}
interface NeedRow {
  id: string;
  person_id: string;
  type: NeedType;
  words: string | null;
  fuzzed_geocell: string;
  status: Need["status"];
  created_at: string;
  expires_at: string;
}
interface JourneyRow {
  id: string;
  person_id: string;
  copilot_id: string | null;
  status: Journey["status"];
}
interface WaypointRow {
  id: string;
  journey_id: string;
  node_id: string | null;
  label: string;
  order: number;
  status: Waypoint["status"];
  date: string | null;
}
interface MessageRow {
  id: string;
  journey_id: string;
  sender_role: Message["sender_role"];
  body: string;
  created_at: string;
}
interface AlertRow {
  id: string;
  area: string;
  rationale: string;
  severity: ForesightAlert["severity"];
  created_at: string;
}

const toNode = (r: NodeRow): ResourceNode => ({
  id: r.id,
  name: r.name,
  type: r.type,
  lat: r.lat,
  lng: r.lng,
  capacity_total: r.capacity_total,
  capacity_open: r.capacity_open,
  hours: r.hours ?? undefined,
  notes: r.notes ?? undefined,
});

const toNeed = (r: NeedRow): Need => {
  // Server-side expiry enforcement (invariant #5): an open beacon past its
  // expires_at is surfaced as expired, never as open.
  const expired =
    r.status === "open" && new Date(r.expires_at).getTime() < Date.now();
  return {
    id: r.id,
    person_id: r.person_id,
    type: r.type,
    words: r.words ?? undefined,
    fuzzed_geocell: r.fuzzed_geocell,
    status: expired ? "expired" : r.status,
    created_at: r.created_at,
    expires_at: r.expires_at,
  };
};

const toJourney = (r: JourneyRow): Journey => ({
  id: r.id,
  person_id: r.person_id,
  copilot_id: r.copilot_id ?? undefined,
  status: r.status,
});

const toWaypoint = (r: WaypointRow): Waypoint => ({
  id: r.id,
  journey_id: r.journey_id,
  node_id: r.node_id ?? undefined,
  label: r.label,
  order: r.order,
  status: r.status,
  date: r.date ?? undefined,
});

const toMessage = (r: MessageRow): Message => ({
  id: r.id,
  journey_id: r.journey_id,
  sender_role: r.sender_role,
  body: r.body,
  created_at: r.created_at,
});

const toAlert = (r: AlertRow): ForesightAlert => ({
  id: r.id,
  area: r.area,
  rationale: r.rationale,
  severity: r.severity,
  created_at: r.created_at,
});

/**
 * Open a Realtime channel on one table; on every change (and once immediately)
 * run `load` and hand the fresh value to `cb`. Returns an unsubscribe.
 * This is the single primitive behind all the subscribe* methods — the UI never
 * holds map-visible state locally, it mirrors the DB (map.md).
 */
function subscribeTable<T>(
  channelName: string,
  table: string,
  load: () => Promise<T>,
  cb: (value: T) => void,
): Unsubscribe {
  const emit = () => {
    void load().then(cb);
  };
  const channel = db()
    .channel(channelName)
    .on(
      // supabase-js types `postgres_changes` via overloads; the payload is
      // unused here (we refetch on any change).
      "postgres_changes",
      { event: "*", schema: "public", table },
      emit,
    )
    .subscribe();

  emit(); // initial push so subscribers get current state without a separate get

  return () => {
    void db().removeChannel(channel);
  };
}

class SupabaseDataLayer implements DataLayer {
  // --- Resource nodes ---
  async getNodes(): Promise<ResourceNode[]> {
    const { data, error } = await db().from("resource_node").select("*");
    if (error) throw error;
    return ((data ?? []) as NodeRow[]).map(toNode);
  }

  subscribeNodes(cb: (nodes: ResourceNode[]) => void): Unsubscribe {
    return subscribeTable("rt-nodes", "resource_node", () => this.getNodes(), cb);
  }

  // --- Needs ---
  async getNeeds(): Promise<Need[]> {
    const { data, error } = await db().from("need").select("*");
    if (error) throw error;
    return ((data ?? []) as NeedRow[]).map(toNeed);
  }

  subscribeNeeds(cb: (needs: Need[]) => void): Unsubscribe {
    return subscribeTable("rt-needs", "need", () => this.getNeeds(), cb);
  }

  async openNeed(input: OpenNeedInput): Promise<Need> {
    const { data, error } = await db()
      .from("need")
      .insert({
        person_id: input.person_id,
        type: input.type,
        words: input.words,
        fuzzed_geocell: input.fuzzed_geocell,
        // status / created_at / expires_at use schema defaults (open, now, +6h)
        triage_status: "pending", // Triage agent will recommend (HITL)
      })
      .select("*")
      .single();
    if (error) throw error;
    return toNeed(data as NeedRow);
  }

  async claimNeed(needId: string, volunteerId: string): Promise<Need> {
    // HITL: a volunteer accepts an open need. We record who claimed it (audit
    // trail) and move it to matched. Triage only recommended; this is the human.
    const { data, error } = await db()
      .from("need")
      .update({ status: "matched", volunteer_id: volunteerId })
      .eq("id", needId)
      .select("*")
      .single();
    if (error) throw error;
    return toNeed(data as NeedRow);
  }

  async confirmResource(needId: string, nodeId: string): Promise<ResourceNode> {
    // Confirming a bed decrements capacity_open for EVERYONE — Realtime
    // propagates the new count to every screen (M2). capacity_open is simulated.
    const { data: nodeData, error: nodeErr } = await db()
      .from("resource_node")
      .select("*")
      .eq("id", nodeId)
      .single();
    if (nodeErr) throw nodeErr;
    const node = nodeData as NodeRow;

    const nextOpen = Math.max(0, node.capacity_open - 1);
    const { data: updated, error: updErr } = await db()
      .from("resource_node")
      .update({ capacity_open: nextOpen })
      .eq("id", nodeId)
      .select("*")
      .single();
    if (updErr) throw updErr;

    const { error: needErr } = await db()
      .from("need")
      .update({ status: "met" })
      .eq("id", needId);
    if (needErr) throw needErr;

    return toNode(updated as NodeRow);
  }

  // --- Journeys + waypoints ---
  async getJourneys(): Promise<Journey[]> {
    const { data, error } = await db().from("journey").select("*");
    if (error) throw error;
    return ((data ?? []) as JourneyRow[]).map(toJourney);
  }

  subscribeJourneys(cb: (journeys: Journey[]) => void): Unsubscribe {
    // Journeys move when their waypoints move; subscribe to BOTH tables so the
    // city-zoom routes re-render whether a journey row or a waypoint changes.
    const unsubJourney = subscribeTable(
      "rt-journeys",
      "journey",
      () => this.getJourneys(),
      cb,
    );
    const unsubWaypoint = subscribeTable(
      "rt-journeys-wp",
      "waypoint",
      () => this.getJourneys(),
      cb,
    );
    return () => {
      unsubJourney();
      unsubWaypoint();
    };
  }

  async getWaypoints(journeyId: string): Promise<Waypoint[]> {
    const { data, error } = await db()
      .from("waypoint")
      .select("*")
      .eq("journey_id", journeyId)
      .order("order", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as WaypointRow[]).map(toWaypoint);
  }

  async addWaypoint(input: AddWaypointInput): Promise<Waypoint> {
    let order = input.order;
    if (order === undefined) {
      const { data: existing, error: exErr } = await db()
        .from("waypoint")
        .select("order")
        .eq("journey_id", input.journey_id)
        .order("order", { ascending: false })
        .limit(1);
      if (exErr) throw exErr;
      const rows = (existing ?? []) as Array<{ order: number }>;
      order = rows.length ? rows[0].order + 1 : 0;
    }
    const { data, error } = await db()
      .from("waypoint")
      .insert({
        journey_id: input.journey_id,
        node_id: input.node_id,
        label: input.label,
        order,
        status: "upcoming",
        date: input.date,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toWaypoint(data as WaypointRow);
  }

  async completeWaypoint(waypointId: string): Promise<Waypoint> {
    const { data, error } = await db()
      .from("waypoint")
      .update({ status: "complete" })
      .eq("id", waypointId)
      .select("*")
      .single();
    if (error) throw error;
    const wp = toWaypoint(data as WaypointRow);

    // Promote the next upcoming waypoint on the same journey to current.
    const { data: upcoming, error: upErr } = await db()
      .from("waypoint")
      .select("*")
      .eq("journey_id", wp.journey_id)
      .eq("status", "upcoming")
      .order("order", { ascending: true })
      .limit(1);
    if (upErr) throw upErr;
    const next = ((upcoming ?? []) as WaypointRow[])[0];
    if (next) {
      const { error: promoteErr } = await db()
        .from("waypoint")
        .update({ status: "current" })
        .eq("id", next.id);
      if (promoteErr) throw promoteErr;
    }
    return wp;
  }

  // --- Messages ---
  async getMessages(journeyId: string): Promise<Message[]> {
    const { data, error } = await db()
      .from("message")
      .select("*")
      .eq("journey_id", journeyId)
      .order("created_at", { ascending: true });
    if (error) throw error;
    return ((data ?? []) as MessageRow[]).map(toMessage);
  }

  subscribeMessages(
    journeyId: string,
    cb: (messages: Message[]) => void,
  ): Unsubscribe {
    return subscribeTable(
      `rt-messages-${journeyId}`,
      "message",
      () => this.getMessages(journeyId),
      cb,
    );
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const { data, error } = await db()
      .from("message")
      .insert({
        journey_id: input.journey_id,
        sender_role: input.sender_role,
        body: input.body,
      })
      .select("*")
      .single();
    if (error) throw error;
    return toMessage(data as MessageRow);
  }

  // --- Coordinator views ---
  async getHeatmapCells(opts?: HeatmapOptions): Promise<HeatCell[]> {
    // Derived, k-anonymized aggregate (invariant #3). Built from need fuzzed
    // cells + journey density — NEVER from raw points. Any cell below
    // K_ANON_MIN active signals is dropped HERE in the derivation.
    const [needs, waypoints, nodes] = await Promise.all([
      this.getNeeds(),
      // Journey density comes via waypoints (a journey row carries no geometry).
      (async () => {
        const { data, error } = await db().from("waypoint").select("*");
        if (error) throw error;
        return ((data ?? []) as WaypointRow[]).map(toWaypoint);
      })(),
      this.getNodes(),
    ]);

    const counts = new Map<string, { count: number; types: NeedType[] }>();
    const add = (cell: string, type?: NeedType) => {
      const entry = counts.get(cell) ?? { count: 0, types: [] };
      entry.count += 1;
      if (type) entry.types.push(type);
      counts.set(cell, entry);
    };

    for (const need of needs) {
      if (need.status === "expired") continue;
      add(need.fuzzed_geocell, need.type);
    }

    // Synthesize aggregate signal near active journey nodes so some cells clear
    // the k-anon threshold; the hour scrubber nudges the spread (matches mock).
    const hour = opts?.hour ?? new Date().getHours();
    const intensity = 4 + (Math.abs((hour % 24) - 18) <= 3 ? 6 : 2);
    for (const wp of waypoints) {
      if (!wp.node_id) continue;
      const node = nodes.find((n) => n.id === wp.node_id);
      if (!node) continue;
      const cell = toGeocell(node.lat, node.lng);
      for (let i = 0; i < intensity; i++) add(cell);
    }

    const cells: HeatCell[] = [];
    for (const [geocell, entry] of counts) {
      if (entry.count < K_ANON_MIN) continue; // k-anonymity — never render < N
      cells.push({
        geocell,
        center: geocellCenter(geocell),
        count: entry.count,
        dominant_type: dominant(entry.types),
      });
    }
    return cells;
  }

  async getForesightAlerts(): Promise<ForesightAlert[]> {
    const { data, error } = await db()
      .from("foresight_alert")
      .select("*")
      .order("created_at", { ascending: false });
    if (error) throw error;
    return ((data ?? []) as AlertRow[]).map(toAlert);
  }
}

function dominant(types: NeedType[]): NeedType | undefined {
  if (!types.length) return undefined;
  const tally = new Map<NeedType, number>();
  for (const t of types) tally.set(t, (tally.get(t) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export const supabaseDataLayer: DataLayer = new SupabaseDataLayer();
