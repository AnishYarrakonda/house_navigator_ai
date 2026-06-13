// Seed data for the in-memory mock layer. Real SF resource nodes only — no
// scripted journeys, needs, messages, or alerts. Those are created by real use
// (a person opening a need, a co-pilot accepting it), not pre-baked demo theater.
//
// Resource LOCATIONS are real, verifiable SF services. capacity_open is
// SIMULATED (SF has no public per-bed feed — see .claude/rules/data-sources.md).

import type {
  ForesightAlert,
  Journey,
  Message,
  Need,
  ResourceNode,
  Volunteer,
  Waypoint,
} from "../../types";

/** Real SF nodes spanning bed / food / hygiene / water / medical / charging. */
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

// No scripted needs / journeys / messages / alerts. These are created by real
// use of the app, not pre-seeded. (Removed the placeholder Tenderloin overflow
// alert and the synthetic Maria/Theo/Rosa journeys + their fabricated message
// threads, which rendered as meaningless routes and fake history on the map.)
export const seedNeeds: Need[] = [];
export const seedJourneys: Journey[] = [];
export const seedWaypoints: Waypoint[] = [];
export const seedMessages: Message[] = [];
export const seedForesightAlerts: ForesightAlert[] = [];
