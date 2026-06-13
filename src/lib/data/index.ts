// The single entry point for app data. Every UI lane imports `db` from here and
// nothing else from this folder. The app runs entirely on the in-memory mock
// data layer (seeded + live DataSF augmentation). FROZEN for the lanes.

import { mockDataLayer } from "./mock";
import type { DataLayer } from "./types";

export const db: DataLayer = mockDataLayer;

export type {
  DataLayer,
  Unsubscribe,
  HeatmapOptions,
  AddWaypointInput,
  SendMessageInput,
} from "./types";
