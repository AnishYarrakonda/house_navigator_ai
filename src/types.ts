// Shared §5 data model for Waypoint. Typed once, reused everywhere
// (DB ↔ UI ↔ agents). See .claude/plans/BIG_PICTURE.md §data-model and
// .claude/rules/privacy.md. FROZEN for the lanes — extend additively only.

export type NeedType = "bed" | "food" | "hygiene" | "medical" | "talk";

export type Role = "crisis" | "volunteer" | "coordinator";

/** Resource node categories the Resource agent classifies into. */
export type ResourceType =
  | "bed"
  | "food"
  | "hygiene"
  | "water"
  | "medical"
  | "charging-wifi";

export type NeedStatus = "open" | "matched" | "met" | "expired";

export type JourneyStatus = "active" | "paused" | "complete";

export type WaypointStatus = "upcoming" | "current" | "complete";

export type SenderRole = "person" | "volunteer" | "system";

/**
 * A person in crisis. NO real-location field — privacy invariant #1.
 * A person's place on the map is the resource they head to, never their body.
 */
export interface Person {
  id: string;
  display_alias: string;
  preferred_language: "en" | "es";
  consent_share_journey: boolean;
  /** Device-session token — no email/password (privacy invariant #6). */
  device_session_token: string;
}

export interface Need {
  id: string;
  person_id: string;
  type: NeedType;
  /** The person's own free-text words — sent to Triage, never mined for PII. */
  words?: string;
  /** ~250m grid cell, fuzzed on capture (privacy invariant #2). Never a precise point. */
  fuzzed_geocell: string;
  status: NeedStatus;
  created_at: string;
  /** Beacons auto-expire (privacy invariant #5). */
  expires_at: string;
}

export interface ResourceNode {
  id: string;
  name: string;
  type: ResourceType;
  lat: number;
  lng: number;
  capacity_total: number;
  /** SIMULATED for the demo — SF has no public per-bed feed (data-sources.md). */
  capacity_open: number;
  hours?: string;
  notes?: string;
}

export interface Journey {
  id: string;
  person_id: string;
  copilot_id?: string;
  status: JourneyStatus;
}

export interface Waypoint {
  id: string;
  journey_id: string;
  node_id?: string;
  label: string;
  order: number;
  status: WaypointStatus;
  date?: string;
}

export interface Volunteer {
  id: string;
  name: string;
  skills: string[];
  active: boolean;
}

export interface Message {
  id: string;
  journey_id: string;
  sender_role: SenderRole;
  body: string;
  created_at: string;
}

/** A k-anonymized heatmap cell — already aggregated & filtered (≥ K_ANON_MIN). */
export interface HeatCell {
  geocell: string;
  /** Center of the cell, [lng, lat] (MapLibre order). */
  center: [number, number];
  /** Signal count — guaranteed ≥ K_ANON_MIN by the data layer. */
  count: number;
  /** Optional dominant need type, for coloring. */
  dominant_type?: NeedType;
}

/** A pre-positioning / overflow alert posted by the Foresight agent. */
export interface ForesightAlert {
  id: string;
  /** District / area label — aggregate, never a person. */
  area: string;
  /** Plain-language rationale shown to the coordinator (ai-agents.md). */
  rationale: string;
  severity: "watch" | "warning";
  created_at: string;
}

/** Input shape for opening a need from the crisis side. */
export interface OpenNeedInput {
  person_id: string;
  type: NeedType;
  words?: string;
  fuzzed_geocell: string;
}
