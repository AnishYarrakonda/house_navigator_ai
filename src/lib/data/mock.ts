// In-memory DataLayer. Seeded from ./seed so the whole app is demoable with NO
// backend. A tiny event emitter re-fires subscriptions on every local mutation,
// so the UI feels live in mock mode (before Realtime is wired in Lane 4).
//
// k-anonymity for the heatmap is enforced HERE in the derivation (privacy
// invariant #3) — cells with < K_ANON_MIN signals are dropped, not hidden in UI.

import { K_ANON_MIN, NEED_EXPIRY_HOURS } from "../../config";
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
import { geocellCenter } from "../geocell";
import type {
  AddWaypointInput,
  DataLayer,
  HeatmapOptions,
  SendMessageInput,
  Unsubscribe,
} from "./types";
import {
  seedForesightAlerts,
  seedJourneys,
  seedMessages,
  seedNeeds,
  seedNodes,
  seedWaypoints,
} from "./seed";

type Listener<T> = (value: T) => void;

/** Minimal multi-topic emitter — fire(topic) re-pushes current state to all. */
class Emitter {
  private listeners = new Map<string, Set<Listener<unknown>>>();

  on<T>(topic: string, cb: Listener<T>): Unsubscribe {
    const set = this.listeners.get(topic) ?? new Set();
    set.add(cb as Listener<unknown>);
    this.listeners.set(topic, set);
    return () => set.delete(cb as Listener<unknown>);
  }

  emit<T>(topic: string, value: T): void {
    this.listeners.get(topic)?.forEach((cb) => cb(value));
  }
}

let nextId = 1000;
const genId = (prefix: string) => `${prefix}-${nextId++}`;

class MockDataLayer implements DataLayer {
  private nodes: ResourceNode[] = structuredClone(seedNodes);
  private needs: Need[] = structuredClone(seedNeeds);
  private journeys: Journey[] = structuredClone(seedJourneys);
  private waypoints: Waypoint[] = structuredClone(seedWaypoints);
  private messages: Message[] = structuredClone(seedMessages);
  private alerts: ForesightAlert[] = structuredClone(seedForesightAlerts);
  private emitter = new Emitter();

  // --- Resource nodes ---
  async getNodes(): Promise<ResourceNode[]> {
    return structuredClone(this.nodes);
  }

  subscribeNodes(cb: (nodes: ResourceNode[]) => void): Unsubscribe {
    return this.emitter.on("nodes", cb as Listener<unknown>);
  }

  private fireNodes() {
    this.emitter.emit("nodes", structuredClone(this.nodes));
  }

  async createNode(input: Omit<ResourceNode, "id">): Promise<ResourceNode> {
    const node: ResourceNode = {
      ...input,
      id: `node-vol-${Math.random().toString(36).slice(2, 8)}`,
    };
    this.nodes.push(node);
    this.fireNodes(); // re-push so useNodes() re-renders → map pin appears live
    return structuredClone(node);
  }

  async updateNode(id: string, patch: Partial<ResourceNode>): Promise<void> {
    const node = this.nodes.find((n) => n.id === id);
    if (!node) throw new Error(`Node not found: ${id}`);
    Object.assign(node, patch);
    this.fireNodes();
  }

  async removeNode(id: string): Promise<void> {
    const before = this.nodes.length;
    this.nodes = this.nodes.filter((n) => n.id !== id);
    if (this.nodes.length !== before) this.fireNodes();
  }

  // --- Needs ---
  private liveNeeds(): Need[] {
    // Server-side expiry enforcement (privacy invariant #5): expired beacons
    // are not surfaced as open.
    const t = Date.now();
    return this.needs.map((n) =>
      n.status === "open" && new Date(n.expires_at).getTime() < t
        ? { ...n, status: "expired" as const }
        : n,
    );
  }

  async getNeeds(): Promise<Need[]> {
    return structuredClone(this.liveNeeds());
  }

  subscribeNeeds(cb: (needs: Need[]) => void): Unsubscribe {
    return this.emitter.on("needs", cb as Listener<unknown>);
  }

  private fireNeeds() {
    this.emitter.emit("needs", structuredClone(this.liveNeeds()));
  }

  async openNeed(input: OpenNeedInput): Promise<Need> {
    const created = new Date();
    const need: Need = {
      id: genId("need"),
      person_id: input.person_id,
      type: input.type,
      words: input.words,
      fuzzed_geocell: input.fuzzed_geocell,
      status: "open",
      created_at: created.toISOString(),
      expires_at: new Date(
        created.getTime() + NEED_EXPIRY_HOURS * 3600_000,
      ).toISOString(),
    };
    this.needs.push(need);
    this.fireNeeds();
    return structuredClone(need);
  }

  async claimNeed(needId: string, _volunteerId: string): Promise<Need> {
    void _volunteerId; // volunteer linkage lives on the journey in this model
    const need = this.needs.find((n) => n.id === needId);
    if (!need) throw new Error(`Need not found: ${needId}`);
    need.status = "matched";
    this.fireNeeds();
    return structuredClone(need);
  }

  async confirmResource(
    needId: string,
    nodeId: string,
  ): Promise<ResourceNode> {
    const need = this.needs.find((n) => n.id === needId);
    if (!need) throw new Error(`Need not found: ${needId}`);
    const node = this.nodes.find((n) => n.id === nodeId);
    if (!node) throw new Error(`Node not found: ${nodeId}`);

    if (node.capacity_open > 0) node.capacity_open -= 1;
    need.status = "met";

    this.fireNodes();
    this.fireNeeds();
    return structuredClone(node);
  }

  // --- Journeys + waypoints ---
  async getJourneys(): Promise<Journey[]> {
    return structuredClone(this.journeys);
  }

  subscribeJourneys(cb: (journeys: Journey[]) => void): Unsubscribe {
    return this.emitter.on("journeys", cb as Listener<unknown>);
  }

  private fireJourneys() {
    this.emitter.emit("journeys", structuredClone(this.journeys));
  }

  async getWaypoints(journeyId: string): Promise<Waypoint[]> {
    return structuredClone(
      this.waypoints
        .filter((w) => w.journey_id === journeyId)
        .sort((a, b) => a.order - b.order),
    );
  }

  async addWaypoint(input: AddWaypointInput): Promise<Waypoint> {
    const existing = this.waypoints.filter(
      (w) => w.journey_id === input.journey_id,
    );
    const order =
      input.order ??
      (existing.length ? Math.max(...existing.map((w) => w.order)) + 1 : 0);
    const wp: Waypoint = {
      id: genId("wp"),
      journey_id: input.journey_id,
      node_id: input.node_id,
      label: input.label,
      order,
      status: "upcoming",
      date: input.date,
    };
    this.waypoints.push(wp);
    this.fireJourneys();
    return structuredClone(wp);
  }

  async completeWaypoint(waypointId: string): Promise<Waypoint> {
    const wp = this.waypoints.find((w) => w.id === waypointId);
    if (!wp) throw new Error(`Waypoint not found: ${waypointId}`);
    wp.status = "complete";
    // Promote the next upcoming waypoint on the same journey to current.
    const next = this.waypoints
      .filter((w) => w.journey_id === wp.journey_id && w.status === "upcoming")
      .sort((a, b) => a.order - b.order)[0];
    if (next) next.status = "current";
    this.fireJourneys();
    return structuredClone(wp);
  }

  // --- Messages ---
  async getMessages(journeyId: string): Promise<Message[]> {
    return structuredClone(
      this.messages
        .filter((m) => m.journey_id === journeyId)
        .sort((a, b) => a.created_at.localeCompare(b.created_at)),
    );
  }

  subscribeMessages(
    journeyId: string,
    cb: (messages: Message[]) => void,
  ): Unsubscribe {
    return this.emitter.on(`messages:${journeyId}`, cb as Listener<unknown>);
  }

  private fireMessages(journeyId: string) {
    const list = this.messages
      .filter((m) => m.journey_id === journeyId)
      .sort((a, b) => a.created_at.localeCompare(b.created_at));
    this.emitter.emit(`messages:${journeyId}`, structuredClone(list));
  }

  async sendMessage(input: SendMessageInput): Promise<Message> {
    const msg: Message = {
      id: genId("msg"),
      journey_id: input.journey_id,
      sender_role: input.sender_role,
      body: input.body,
      created_at: new Date().toISOString(),
    };
    this.messages.push(msg);
    this.fireMessages(input.journey_id);
    return structuredClone(msg);
  }

  // --- Coordinator views ---
  async getHeatmapCells(opts?: HeatmapOptions): Promise<HeatCell[]> {
    // Derive from need fuzzed cells + journey waypoint nodes. k-anonymity is
    // enforced here: any cell with < K_ANON_MIN signals is dropped entirely.
    const counts = new Map<string, { count: number; types: NeedType[] }>();

    const add = (cell: string, type?: NeedType) => {
      const entry = counts.get(cell) ?? { count: 0, types: [] };
      entry.count += 1;
      if (type) entry.types.push(type);
      counts.set(cell, entry);
    };

    for (const need of this.liveNeeds()) {
      if (need.status === "expired") continue;
      add(need.fuzzed_geocell, need.type);
    }
    void opts;

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
    return structuredClone(this.alerts);
  }
}

function dominant(types: NeedType[]): NeedType | undefined {
  if (!types.length) return undefined;
  const tally = new Map<NeedType, number>();
  for (const t of types) tally.set(t, (tally.get(t) ?? 0) + 1);
  return [...tally.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

export const mockDataLayer: DataLayer = new MockDataLayer();
