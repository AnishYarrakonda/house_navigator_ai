// Seed data for the in-memory mock layer. The whole app runs on this — no
// backend, no external feeds. Resource nodes are DEMO data: ~200 believable SF
// resource locations spread across the city's real neighborhoods, each with a
// plain-language description of what's available and a (simulated) capacity, so
// the matcher's "closest / most-resources / balanced" ranking is meaningful.
//
// Everything here is SIMULATED for the demo (`simulated: true`) — SF publishes
// no public per-site inventory or per-bed availability feed, so we generate a
// rich, stable dataset deterministically rather than depending on a flaky live
// API (see .claude/rules/data-sources.md). Generation is seeded, so the same
// 200 nodes (names, coords, capacity) appear on every load.

import type {
  ForesightAlert,
  Journey,
  Message,
  Need,
  ResourceNode,
  ResourceType,
  Volunteer,
  Waypoint,
} from "../../types";

// ── Deterministic PRNG (mulberry32) so the dataset is stable across reloads ──
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// Real SF neighborhoods (approx. centroids) — pins spread believably citywide.
interface Hood {
  name: string;
  lat: number;
  lng: number;
}
const HOODS: Hood[] = [
  { name: "Tenderloin", lat: 37.784, lng: -122.413 },
  { name: "SoMa", lat: 37.7785, lng: -122.4056 },
  { name: "Mission", lat: 37.7599, lng: -122.4148 },
  { name: "Bayview", lat: 37.7299, lng: -122.387 },
  { name: "Castro", lat: 37.7609, lng: -122.435 },
  { name: "Haight-Ashbury", lat: 37.77, lng: -122.4469 },
  { name: "Western Addition", lat: 37.7805, lng: -122.4324 },
  { name: "Inner Richmond", lat: 37.78, lng: -122.4646 },
  { name: "Outer Richmond", lat: 37.778, lng: -122.486 },
  { name: "Inner Sunset", lat: 37.76, lng: -122.469 },
  { name: "Outer Sunset", lat: 37.752, lng: -122.494 },
  { name: "Marina", lat: 37.803, lng: -122.436 },
  { name: "North Beach", lat: 37.806, lng: -122.41 },
  { name: "Chinatown", lat: 37.7941, lng: -122.4078 },
  { name: "Excelsior", lat: 37.724, lng: -122.43 },
  { name: "Visitacion Valley", lat: 37.717, lng: -122.405 },
  { name: "Potrero Hill", lat: 37.758, lng: -122.4 },
  { name: "Civic Center", lat: 37.779, lng: -122.417 },
  { name: "Financial District", lat: 37.7946, lng: -122.3999 },
  { name: "Dogpatch", lat: 37.76, lng: -122.388 },
  { name: "Nob Hill", lat: 37.793, lng: -122.415 },
  { name: "Russian Hill", lat: 37.801, lng: -122.418 },
  { name: "Hayes Valley", lat: 37.776, lng: -122.424 },
  { name: "NoPa", lat: 37.775, lng: -122.44 },
  { name: "Glen Park", lat: 37.734, lng: -122.433 },
  { name: "Ingleside", lat: 37.722, lng: -122.456 },
  { name: "Portola", lat: 37.725, lng: -122.406 },
  { name: "Outer Mission", lat: 37.723, lng: -122.446 },
  { name: "Lower Haight", lat: 37.772, lng: -122.431 },
  { name: "Japantown", lat: 37.786, lng: -122.429 },
  { name: "Cole Valley", lat: 37.7665, lng: -122.45 },
  { name: "Noe Valley", lat: 37.751, lng: -122.433 },
  { name: "Bernal Heights", lat: 37.741, lng: -122.415 },
  { name: "Twin Peaks", lat: 37.754, lng: -122.447 },
  { name: "Diamond Heights", lat: 37.741, lng: -122.44 },
  { name: "West Portal", lat: 37.7405, lng: -122.4663 },
  { name: "Forest Hill", lat: 37.747, lng: -122.466 },
  { name: "Parkside", lat: 37.741, lng: -122.488 },
  { name: "Mission Bay", lat: 37.77, lng: -122.39 },
  { name: "South Beach", lat: 37.782, lng: -122.3893 },
  { name: "Cow Hollow", lat: 37.797, lng: -122.436 },
  { name: "Pacific Heights", lat: 37.7925, lng: -122.438 },
  { name: "Presidio Heights", lat: 37.788, lng: -122.456 },
  { name: "Sunnyside", lat: 37.732, lng: -122.447 },
  { name: "Oceanview", lat: 37.718, lng: -122.457 },
  { name: "Crocker-Amazon", lat: 37.712, lng: -122.44 },
  { name: "Mission Terrace", lat: 37.727, lng: -122.435 },
  { name: "Duboce Triangle", lat: 37.769, lng: -122.433 },
  { name: "Lone Mountain", lat: 37.78, lng: -122.452 },
];

// SF bounding box (rough). Points are kept only near a neighborhood anchor, a
// coarse land mask that keeps pins out of the bay/ocean.
const SF_BOUNDS = { minLat: 37.708, maxLat: 37.806, minLng: -122.51, maxLng: -122.357 };

const HOURS = ["24/7", "Daily 7a–10p", "Mon–Fri 9a–6p", "Daily 6a–9p", "Mon–Sat 8a–8p", "Daily 8a–6p"];

interface TypePlan {
  type: ResourceType;
  count: number;
  minCap: number;
  maxCap: number;
  suffixes: string[];
  notes: (total: number) => string[];
}

// HOUSING ONLY — every node is a shelter / bed / housing site (type "bed").
// Food / hygiene / water / medical / charging were removed; this is a
// housing-focused map. Volunteer-posted listings (added at runtime) can still be
// any type. Capacity varies widely so "most resources" is meaningful.
const TYPE_PLAN: TypePlan[] = [
  {
    type: "bed",
    count: 200,
    minCap: 12,
    maxCap: 140,
    suffixes: [
      "Navigation Center",
      "Emergency Shelter",
      "Family Shelter",
      "Interfaith Shelter",
      "Safe Haven",
      "Overnight Shelter",
      "Transitional Housing",
      "SRO Residence",
      "Supportive Housing",
      "Safe Parking Site",
      "Cabin Village",
      "Shelter & Beds",
      "Women's Shelter",
      "Youth Shelter",
      "Respite Beds",
    ],
    notes: (t) => [
      `≈${t} beds — cots, blankets, hot dinner & breakfast, lockers, and showers.`,
      `≈${t} beds with family rooms so you can stay together, a kids' area, and meals.`,
      `≈${t} mats and beds, evening meal, case management, pets OK in on-site kennels.`,
      `≈${t} single beds, laundry, secure storage, restrooms, and 24-hour staff.`,
      `≈${t} private SRO rooms with a shared kitchen, case management, and mail service.`,
      `≈${t} safe-parking spots with restrooms, overnight security, and morning coffee.`,
      `≈${t} cabins with heat and power, meals on site, and housing navigation.`,
      `≈${t} beds for women & families — showers, a clothing closet, and counseling.`,
    ],
  },
];

function slug(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
}

function generateNodes(): ResourceNode[] {
  const rng = mulberry32(20240607);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rng() * arr.length)];
  const planByType = new Map(TYPE_PLAN.map((p) => [p.type, p]));

  // A deterministic "bag" of types matching the per-type quotas (sums to 200),
  // shuffled so the categories interleave across the city.
  const typeBag: ResourceType[] = [];
  for (const p of TYPE_PLAN) for (let j = 0; j < p.count; j++) typeBag.push(p.type);
  for (let i = typeBag.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [typeBag[i], typeBag[j]] = [typeBag[j], typeBag[i]];
  }

  // Even citywide spread: walk a jittered grid over the SF bbox and keep every
  // cell whose center is within ~1.1km of a neighborhood anchor (a coarse land
  // mask — keeps pins off the bay/ocean and names each by its nearest hood).
  // Grid spacing (~0.6km) is well above the map's cluster radius, so the result
  // reads as ~200 individual pins at city zoom rather than a few fat clusters.
  const STEP_LAT = 0.0055;
  const STEP_LNG = 0.0068;
  const LAND_R2 = 0.0105 * 0.0105; // (~1.1km)^2 in squared degrees
  const candidates: Array<{ lat: number; lng: number; hood: Hood }> = [];
  for (let lat = SF_BOUNDS.minLat; lat <= SF_BOUNDS.maxLat; lat += STEP_LAT) {
    for (let lng = SF_BOUNDS.minLng; lng <= SF_BOUNDS.maxLng; lng += STEP_LNG) {
      const jlat = lat + (rng() - 0.5) * STEP_LAT * 0.9;
      const jlng = lng + (rng() - 0.5) * STEP_LNG * 0.9;
      let best: Hood | null = null;
      let bestD = Infinity;
      for (const h of HOODS) {
        const d = (h.lat - jlat) ** 2 + (h.lng - jlng) ** 2;
        if (d < bestD) {
          bestD = d;
          best = h;
        }
      }
      if (best && bestD <= LAND_R2) candidates.push({ lat: jlat, lng: jlng, hood: best });
    }
  }
  // Shuffle then take 200 — a random subset of an even grid is still even.
  for (let i = candidates.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
  }
  const chosen = candidates.slice(0, typeBag.length);

  return chosen.map((c, i) => {
    const type = typeBag[i % typeBag.length];
    const plan = planByType.get(type) ?? TYPE_PLAN[0];
    const total = plan.minCap + Math.floor(rng() * (plan.maxCap - plan.minCap + 1));
    // Open is a believable fraction of total; some sites are full (0).
    const open = Math.min(total, Math.round(total * (rng() * 0.95)));
    return {
      id: `node-${type}-${i}-${slug(c.hood.name)}`,
      name: `${c.hood.name} ${pick(plan.suffixes)}`,
      type,
      lat: c.lat,
      lng: c.lng,
      capacity_total: total,
      capacity_open: open,
      hours: pick(HOURS),
      notes: pick(plan.notes(total)),
      address: `${c.hood.name}, San Francisco`,
      simulated: true,
    };
  });
}

/**
 * ~200 believable SF resource locations (bed / food / hygiene / water / medical
 * / charging-wifi) spread across the city. DEMO data — locations and capacity
 * are simulated and stable (deterministically generated).
 */
export const seedNodes: ResourceNode[] = generateNodes();

export const seedVolunteers: Volunteer[] = [
  { id: "vol-amara", name: "Amara", skills: ["housing", "spanish"], active: true },
  { id: "vol-dev", name: "Dev", skills: ["benefits", "medical"], active: true },
  { id: "vol-lin", name: "Lin", skills: ["outreach"], active: false },
];

// No scripted needs / journeys / messages / alerts. These are created by real
// use of the app (a person opening a need, a co-pilot accepting it), not
// pre-seeded demo theater.
export const seedNeeds: Need[] = [];
export const seedJourneys: Journey[] = [];
export const seedWaypoints: Waypoint[] = [];
export const seedMessages: Message[] = [];
export const seedForesightAlerts: ForesightAlert[] = [];
