// Seed data for the in-memory mock layer. ~12 real-ish SF resource nodes,
// scripted in-flight journeys with waypoints, a couple of open needs, and a
// Foresight alert — so the whole app is alive and believable with NO backend.
//
// capacity_open is SIMULATED (SF has no public per-bed feed — see
// .claude/rules/data-sources.md). Locations are real-ish SF coordinates.

import type {
  ForesightAlert,
  Journey,
  Message,
  Need,
  ResourceNode,
  Volunteer,
  Waypoint,
} from "../../types";
import { toGeocell } from "../geocell";

const now = Date.now();
const hoursFromNow = (h: number) => new Date(now + h * 3600_000).toISOString();
const hoursAgo = (h: number) => new Date(now - h * 3600_000).toISOString();

/** ~12 SF nodes spanning bed / food / hygiene / water / medical / charging. */
export const seedNodes: ResourceNode[] = [
  {
    id: "node-msc-south",
    name: "MSC South Shelter",
    type: "bed",
    lat: 37.7765,
    lng: -122.4053,
    capacity_total: 340,
    capacity_open: 12,
    hours: "24/7 intake",
    notes: "Large shelter near 5th & Bryant. Mats and beds.",
  },
  {
    id: "node-next-door",
    name: "Next Door Shelter",
    type: "bed",
    lat: 37.7836,
    lng: -122.4146,
    capacity_total: 334,
    capacity_open: 4,
    hours: "Reservation-based",
    notes: "Polk St. Pet-friendly kennels available.",
  },
  {
    id: "node-sanctuary",
    name: "Sanctuary SF",
    type: "bed",
    lat: 37.7785,
    lng: -122.4096,
    capacity_total: 200,
    capacity_open: 0,
    hours: "Evening intake",
    notes: "8th St. Currently full — check back after 6pm.",
  },
  {
    id: "node-glide",
    name: "GLIDE Daily Free Meals",
    type: "food",
    lat: 37.7831,
    lng: -122.4126,
    capacity_total: 600,
    capacity_open: 420,
    hours: "Breakfast 8a, Lunch 12p, Dinner 4p",
    notes: "Ellis St. No questions asked.",
  },
  {
    id: "node-stanthony",
    name: "St. Anthony's Dining Room",
    type: "food",
    lat: 37.7826,
    lng: -122.4124,
    capacity_total: 500,
    capacity_open: 310,
    hours: "Lunch 11:30a–1:30p daily",
    notes: "Golden Gate Ave. Hot lunch.",
  },
  {
    id: "node-foodbank-pantry",
    name: "SF-Marin Food Bank Pantry",
    type: "food",
    lat: 37.7479,
    lng: -122.4053,
    capacity_total: 300,
    capacity_open: 180,
    hours: "Wed & Sat 10a–1p",
    notes: "Free groceries. Bring a bag.",
  },
  {
    id: "node-pitstop-16th",
    name: "Pit Stop — 16th & Mission",
    type: "hygiene",
    lat: 37.7649,
    lng: -122.4197,
    capacity_total: 4,
    capacity_open: 3,
    hours: "9a–7p",
    notes: "Staffed toilets, sink, needle disposal.",
  },
  {
    id: "node-pitstop-civic",
    name: "Pit Stop — Civic Center",
    type: "hygiene",
    lat: 37.7796,
    lng: -122.4156,
    capacity_total: 4,
    capacity_open: 2,
    hours: "7a–9p",
    notes: "UN Plaza. Toilets + handwashing.",
  },
  {
    id: "node-lava-mae",
    name: "Mobile Showers (Bayview)",
    type: "hygiene",
    lat: 37.7299,
    lng: -122.3892,
    capacity_total: 6,
    capacity_open: 5,
    hours: "Tue/Thu 9a–12p",
    notes: "Hot showers + towels.",
  },
  {
    id: "node-water-dolores",
    name: "Public Water — Dolores Park",
    type: "water",
    lat: 37.7596,
    lng: -122.4269,
    capacity_total: 999,
    capacity_open: 999,
    hours: "Daylight",
    notes: "Refill stations near the playground.",
  },
  {
    id: "node-clinic-tom-waddell",
    name: "Tom Waddell Urban Health Clinic",
    type: "medical",
    lat: 37.7818,
    lng: -122.4136,
    capacity_total: 80,
    capacity_open: 22,
    hours: "Mon–Fri 8a–5p",
    notes: "Walk-in care. Wound care, meds, mental health.",
  },
  {
    id: "node-library-main",
    name: "SF Main Library — Charging & Wi-Fi",
    type: "charging-wifi",
    lat: 37.7786,
    lng: -122.4156,
    capacity_total: 120,
    capacity_open: 64,
    hours: "Mon–Sat 10a–6p",
    notes: "Outlets, free Wi-Fi, social worker on Tue.",
  },
];

export const seedVolunteers: Volunteer[] = [
  { id: "vol-amara", name: "Amara", skills: ["housing", "spanish"], active: true },
  { id: "vol-dev", name: "Dev", skills: ["benefits", "medical"], active: true },
  { id: "vol-lin", name: "Lin", skills: ["outreach"], active: false },
];

// --- Scripted people (no real location stored, ever) ---
const cellTenderloin = toGeocell(37.7836, -122.4146);
const cellMission = toGeocell(37.7649, -122.4197);

export const seedNeeds: Need[] = [
  {
    id: "need-open-1",
    person_id: "person-jules",
    type: "bed",
    words: "me and my dog, nowhere safe tonight, can't be split up",
    fuzzed_geocell: cellTenderloin,
    status: "open",
    created_at: hoursAgo(0.3),
    expires_at: hoursFromNow(5.7),
  },
  {
    id: "need-open-2",
    person_id: "person-sam",
    type: "food",
    words: "haven't eaten since yesterday",
    fuzzed_geocell: cellMission,
    status: "open",
    created_at: hoursAgo(0.8),
    expires_at: hoursFromNow(5.2),
  },
];

// Maria's path home — the pre-baked glowing journey for the hero shot (M0).
export const seedJourneys: Journey[] = [
  {
    id: "journey-maria",
    person_id: "person-maria",
    copilot_id: "vol-amara",
    status: "active",
  },
  {
    id: "journey-theo",
    person_id: "person-theo",
    copilot_id: "vol-dev",
    status: "active",
  },
  {
    id: "journey-rosa",
    person_id: "person-rosa",
    copilot_id: "vol-amara",
    status: "active",
  },
];

export const seedWaypoints: Waypoint[] = [
  // Maria — reached out → safe tonight (done), ID next (upcoming)
  {
    id: "wp-maria-1",
    journey_id: "journey-maria",
    label: "Reached out",
    order: 0,
    status: "complete",
    date: hoursAgo(72),
  },
  {
    id: "wp-maria-2",
    journey_id: "journey-maria",
    node_id: "node-next-door",
    label: "Safe tonight — Next Door Shelter",
    order: 1,
    status: "complete",
    date: hoursAgo(48),
  },
  {
    id: "wp-maria-3",
    journey_id: "journey-maria",
    label: "Replace ID at DMV",
    order: 2,
    status: "current",
    date: hoursFromNow(24),
  },
  {
    id: "wp-maria-4",
    journey_id: "journey-maria",
    label: "CalFresh / benefits",
    order: 3,
    status: "upcoming",
  },
  // Theo
  {
    id: "wp-theo-1",
    journey_id: "journey-theo",
    label: "Reached out",
    order: 0,
    status: "complete",
    date: hoursAgo(20),
  },
  {
    id: "wp-theo-2",
    journey_id: "journey-theo",
    node_id: "node-msc-south",
    label: "Safe tonight — MSC South",
    order: 1,
    status: "current",
    date: hoursAgo(2),
  },
  {
    id: "wp-theo-3",
    journey_id: "journey-theo",
    label: "Coordinated Entry assessment",
    order: 2,
    status: "upcoming",
  },
  // Rosa
  {
    id: "wp-rosa-1",
    journey_id: "journey-rosa",
    label: "Reached out",
    order: 0,
    status: "complete",
    date: hoursAgo(120),
  },
  {
    id: "wp-rosa-2",
    journey_id: "journey-rosa",
    node_id: "node-sanctuary",
    label: "Safe tonight — Sanctuary SF",
    order: 1,
    status: "complete",
    date: hoursAgo(96),
  },
  {
    id: "wp-rosa-3",
    journey_id: "journey-rosa",
    label: "Got CalFresh",
    order: 2,
    status: "complete",
    date: hoursAgo(24),
  },
  {
    id: "wp-rosa-4",
    journey_id: "journey-rosa",
    label: "Housing assessment scheduled",
    order: 3,
    status: "current",
    date: hoursFromNow(48),
  },
];

export const seedMessages: Message[] = [
  {
    id: "msg-maria-1",
    journey_id: "journey-maria",
    sender_role: "volunteer",
    body: "Hi Maria — I'm Amara, I'll walk this with you. There's a bed held at Next Door tonight.",
    created_at: hoursAgo(48.5),
  },
  {
    id: "msg-maria-2",
    journey_id: "journey-maria",
    sender_role: "person",
    body: "thank you. what do i bring?",
    created_at: hoursAgo(48.2),
  },
  {
    id: "msg-maria-3",
    journey_id: "journey-maria",
    sender_role: "volunteer",
    body: "Just yourself. Intake is open now — they're expecting you.",
    created_at: hoursAgo(48),
  },
];

export const seedForesightAlerts: ForesightAlert[] = [
  {
    id: "alert-tenderloin",
    area: "Tenderloin",
    rationale:
      "Cold front tonight (low 42°F, rain), shelter waitlist up 18% this week, and 311 homeless-concern reports clustering near Ellis & Jones. Recommend pre-positioning 30 overflow mats.",
    severity: "warning",
    created_at: hoursAgo(1),
  },
];
