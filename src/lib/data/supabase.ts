// Live (Supabase + Realtime) DataLayer — STUB for now. Lane 4 fills this in
// behind the same DataLayer interface, then it's selected by VITE_DATA_MODE=live
// in ./index.ts (no other file changes). Until then every method throws so a
// premature flip to live mode fails loudly rather than silently.

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
import type {
  AddWaypointInput,
  DataLayer,
  HeatmapOptions,
  SendMessageInput,
  Unsubscribe,
} from "./types";

const notImpl = (): never => {
  throw new Error("Not implemented (Lane 4)");
};

export const supabaseDataLayer: DataLayer = {
  getNodes: (): Promise<ResourceNode[]> => notImpl(),
  subscribeNodes: (): Unsubscribe => notImpl(),
  getNeeds: (): Promise<Need[]> => notImpl(),
  subscribeNeeds: (): Unsubscribe => notImpl(),
  openNeed: (_input: OpenNeedInput): Promise<Need> => notImpl(),
  claimNeed: (_needId: string, _volunteerId: string): Promise<Need> =>
    notImpl(),
  confirmResource: (_needId: string, _nodeId: string): Promise<ResourceNode> =>
    notImpl(),
  getJourneys: (): Promise<Journey[]> => notImpl(),
  subscribeJourneys: (): Unsubscribe => notImpl(),
  getWaypoints: (_journeyId: string): Promise<Waypoint[]> => notImpl(),
  addWaypoint: (_input: AddWaypointInput): Promise<Waypoint> => notImpl(),
  completeWaypoint: (_waypointId: string): Promise<Waypoint> => notImpl(),
  getMessages: (_journeyId: string): Promise<Message[]> => notImpl(),
  subscribeMessages: (): Unsubscribe => notImpl(),
  sendMessage: (_input: SendMessageInput): Promise<Message> => notImpl(),
  getHeatmapCells: (_opts?: HeatmapOptions): Promise<HeatCell[]> => notImpl(),
  getForesightAlerts: (): Promise<ForesightAlert[]> => notImpl(),
};
