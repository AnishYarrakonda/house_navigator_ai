// The single entry point for app data. Every UI lane imports `db` from here and
// nothing else from this folder. Selected by VITE_DATA_MODE: "live" → Supabase
// (Lane 4), anything else → the in-memory mock. FROZEN for the lanes.

import { DATA_MODE } from "../../config";
import { mockDataLayer } from "./mock";
import { supabaseDataLayer } from "./supabase";
import type { DataLayer } from "./types";

export const db: DataLayer =
  DATA_MODE === "live" ? supabaseDataLayer : mockDataLayer;

export type {
  DataLayer,
  Unsubscribe,
  HeatmapOptions,
  AddWaypointInput,
  SendMessageInput,
} from "./types";
