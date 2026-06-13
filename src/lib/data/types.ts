// The DataLayer contract. ALL UI lanes depend on this interface and nothing
// else — they never touch the mock or the Supabase impl directly, only `db`
// from ./index. FROZEN for the lanes. Extra unused methods are cheaper than a
// mid-hackathon contract change, so the surface is deliberately complete.

import type {
  ForesightAlert,
  HeatCell,
  Journey,
  Message,
  Need,
  OpenNeedInput,
  ResourceNode,
  Waypoint,
} from "../../types";

/** Every subscribe* returns this — call it to stop receiving updates. */
export type Unsubscribe = () => void;

export interface HeatmapOptions {
  /** Optional hour-of-day (0–23) for the time scrubber (M4). */
  hour?: number;
}

export interface AddWaypointInput {
  journey_id: string;
  label: string;
  node_id?: string;
  /** Defaults to appended-at-end if omitted. */
  order?: number;
  date?: string;
}

export interface SendMessageInput {
  journey_id: string;
  sender_role: Message["sender_role"];
  body: string;
}

/**
 * The shared blackboard, behind one interface. In mock mode this is in-memory
 * with a tiny event emitter so the UI feels live; in live mode (Lane 4) it's
 * Supabase + Realtime. Same surface, swapped by VITE_DATA_MODE.
 */
export interface DataLayer {
  // --- Resource nodes (pins + live capacity) ---
  getNodes(): Promise<ResourceNode[]>;
  subscribeNodes(cb: (nodes: ResourceNode[]) => void): Unsubscribe;
  /** Create a new resource node (volunteer-posted listing). */
  createNode(input: Omit<ResourceNode, "id">): Promise<ResourceNode>;
  /** Patch a node's fields (e.g. capacity, mark full). */
  updateNode(id: string, patch: Partial<ResourceNode>): Promise<void>;
  /** Remove a node (volunteer removes their listing). */
  removeNode(id: string): Promise<void>;

  // --- Needs (beacons) ---
  getNeeds(): Promise<Need[]>;
  subscribeNeeds(cb: (needs: Need[]) => void): Unsubscribe;
  openNeed(input: OpenNeedInput): Promise<Need>;
  /** A volunteer claims an open need (HITL accept). */
  claimNeed(needId: string, volunteerId: string): Promise<Need>;
  /** Confirm a resource for a need — decrements that node's capacity_open. */
  confirmResource(needId: string, nodeId: string): Promise<ResourceNode>;

  // --- Journeys + waypoints (the path home) ---
  getJourneys(): Promise<Journey[]>;
  subscribeJourneys(cb: (journeys: Journey[]) => void): Unsubscribe;
  getWaypoints(journeyId: string): Promise<Waypoint[]>;
  addWaypoint(input: AddWaypointInput): Promise<Waypoint>;
  completeWaypoint(waypointId: string): Promise<Waypoint>;

  // --- Messages (co-pilot thread) ---
  getMessages(journeyId: string): Promise<Message[]>;
  subscribeMessages(
    journeyId: string,
    cb: (messages: Message[]) => void,
  ): Unsubscribe;
  sendMessage(input: SendMessageInput): Promise<Message>;

  // --- Coordinator views (already k-anonymized / aggregated) ---
  getHeatmapCells(opts?: HeatmapOptions): Promise<HeatCell[]>;
  getForesightAlerts(): Promise<ForesightAlert[]>;
}
