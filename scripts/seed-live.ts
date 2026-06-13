/**
 * Seed the live Supabase project via the REST API (anon key; RLS is off for the
 * demo). Mirrors supabase/seed.sql so live mode matches the in-memory mock.
 * Idempotent: upserts on id (Prefer: resolution=merge-duplicates).
 *
 *   npx tsx scripts/seed-live.ts
 *
 * Locations are REAL SF resource nodes; capacity_open is SIMULATED (no public
 * per-bed feed). Journeys/needs/messages are the scripted demo story.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// --- env (no dotenv dep) ----------------------------------------------------
const env: Record<string, string> = {};
try {
  for (const line of readFileSync(resolve(process.cwd(), '.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
} catch {
  /* fall through to process.env */
}
const URL = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? '';
const KEY = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? '';
if (!URL || !KEY) {
  console.error('Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local');
  process.exit(1);
}

// --- relative-time helpers (seed.sql uses now() +/- interval) ---------------
const now = Date.now();
const mins = (n: number) => new Date(now + n * 60_000).toISOString();
const hrs = (n: number) => new Date(now + n * 3_600_000).toISOString();

// --- the seed data (mirrors supabase/seed.sql) ------------------------------
const person = [
  { id: 'person-jules', display_alias: 'Jules', preferred_language: 'en', consent_share_journey: false, device_session_token: 'seed-token-jules' },
  { id: 'person-sam', display_alias: 'Sam', preferred_language: 'es', consent_share_journey: false, device_session_token: 'seed-token-sam' },
  { id: 'person-maria', display_alias: 'Maria', preferred_language: 'es', consent_share_journey: true, device_session_token: 'seed-token-maria' },
  { id: 'person-theo', display_alias: 'Theo', preferred_language: 'en', consent_share_journey: true, device_session_token: 'seed-token-theo' },
  { id: 'person-rosa', display_alias: 'Rosa', preferred_language: 'es', consent_share_journey: true, device_session_token: 'seed-token-rosa' },
];

const volunteer = [
  { id: 'vol-amara', name: 'Amara', skills: ['housing', 'spanish'], active: true },
  { id: 'vol-dev', name: 'Dev', skills: ['benefits', 'medical'], active: true },
  { id: 'vol-lin', name: 'Lin', skills: ['outreach'], active: false },
];

const resource_node = [
  { id: 'node-msc-south', name: 'MSC South Shelter', type: 'bed', lat: 37.7765, lng: -122.4053, capacity_total: 340, capacity_open: 12, hours: '24/7 intake', notes: 'Large shelter near 5th & Bryant. Mats and beds.' },
  { id: 'node-next-door', name: 'Next Door Shelter', type: 'bed', lat: 37.7836, lng: -122.4146, capacity_total: 334, capacity_open: 4, hours: 'Reservation-based', notes: 'Polk St. Pet-friendly kennels available.' },
  { id: 'node-sanctuary', name: 'Sanctuary SF', type: 'bed', lat: 37.7785, lng: -122.4096, capacity_total: 200, capacity_open: 0, hours: 'Evening intake', notes: '8th St. Currently full — check back after 6pm.' },
  { id: 'node-glide', name: 'GLIDE Daily Free Meals', type: 'food', lat: 37.7831, lng: -122.4126, capacity_total: 600, capacity_open: 420, hours: 'Breakfast 8a, Lunch 12p, Dinner 4p', notes: 'Ellis St. No questions asked.' },
  { id: 'node-stanthony', name: "St. Anthony's Dining Room", type: 'food', lat: 37.7826, lng: -122.4124, capacity_total: 500, capacity_open: 310, hours: 'Lunch 11:30a–1:30p daily', notes: 'Golden Gate Ave. Hot lunch.' },
  { id: 'node-foodbank-pantry', name: 'SF-Marin Food Bank Pantry', type: 'food', lat: 37.7479, lng: -122.4053, capacity_total: 300, capacity_open: 180, hours: 'Wed & Sat 10a–1p', notes: 'Free groceries. Bring a bag.' },
  { id: 'node-pitstop-16th', name: 'Pit Stop — 16th & Mission', type: 'hygiene', lat: 37.7649, lng: -122.4197, capacity_total: 4, capacity_open: 3, hours: '9a–7p', notes: 'Staffed toilets, sink, needle disposal.' },
  { id: 'node-pitstop-civic', name: 'Pit Stop — Civic Center', type: 'hygiene', lat: 37.7796, lng: -122.4156, capacity_total: 4, capacity_open: 2, hours: '7a–9p', notes: 'UN Plaza. Toilets + handwashing.' },
  { id: 'node-lava-mae', name: 'Mobile Showers (Bayview)', type: 'hygiene', lat: 37.7299, lng: -122.3892, capacity_total: 6, capacity_open: 5, hours: 'Tue/Thu 9a–12p', notes: 'Hot showers + towels.' },
  { id: 'node-water-dolores', name: 'Public Water — Dolores Park', type: 'water', lat: 37.7596, lng: -122.4269, capacity_total: 999, capacity_open: 999, hours: 'Daylight', notes: 'Refill stations near the playground.' },
  { id: 'node-clinic-tom-waddell', name: 'Tom Waddell Urban Health Clinic', type: 'medical', lat: 37.7818, lng: -122.4136, capacity_total: 80, capacity_open: 22, hours: 'Mon–Fri 8a–5p', notes: 'Walk-in care. Wound care, meds, mental health.' },
  { id: 'node-library-main', name: 'SF Main Library — Charging & Wi-Fi', type: 'charging-wifi', lat: 37.7786, lng: -122.4156, capacity_total: 120, capacity_open: 64, hours: 'Mon–Sat 10a–6p', notes: 'Outlets, free Wi-Fi, social worker on Tue.' },
];

const journey = [
  { id: 'journey-maria', person_id: 'person-maria', copilot_id: 'vol-amara', status: 'active' },
  { id: 'journey-theo', person_id: 'person-theo', copilot_id: 'vol-dev', status: 'active' },
  { id: 'journey-rosa', person_id: 'person-rosa', copilot_id: 'vol-amara', status: 'active' },
];

const need = [
  { id: 'need-open-1', person_id: 'person-jules', type: 'bed', words: "me and my dog, nowhere safe tonight, can't be split up", fuzzed_geocell: 'g_16792_-54407', status: 'open', created_at: mins(-18), expires_at: mins(342) },
  { id: 'need-open-2', person_id: 'person-sam', type: 'food', words: "haven't eaten since yesterday", fuzzed_geocell: 'g_16784_-54409', status: 'open', created_at: mins(-48), expires_at: mins(312) },
];

const waypoint = [
  { id: 'wp-maria-1', journey_id: 'journey-maria', node_id: null, label: 'Reached out', order: 0, status: 'complete', date: hrs(-72) },
  { id: 'wp-maria-2', journey_id: 'journey-maria', node_id: 'node-next-door', label: 'Safe tonight — Next Door Shelter', order: 1, status: 'complete', date: hrs(-48) },
  { id: 'wp-maria-3', journey_id: 'journey-maria', node_id: null, label: 'Replace ID at DMV', order: 2, status: 'current', date: hrs(24) },
  { id: 'wp-maria-4', journey_id: 'journey-maria', node_id: null, label: 'CalFresh / benefits', order: 3, status: 'upcoming', date: null },
  { id: 'wp-theo-1', journey_id: 'journey-theo', node_id: null, label: 'Reached out', order: 0, status: 'complete', date: hrs(-20) },
  { id: 'wp-theo-2', journey_id: 'journey-theo', node_id: 'node-msc-south', label: 'Safe tonight — MSC South', order: 1, status: 'current', date: hrs(-2) },
  { id: 'wp-theo-3', journey_id: 'journey-theo', node_id: null, label: 'Coordinated Entry assessment', order: 2, status: 'upcoming', date: null },
  { id: 'wp-rosa-1', journey_id: 'journey-rosa', node_id: null, label: 'Reached out', order: 0, status: 'complete', date: hrs(-120) },
  { id: 'wp-rosa-2', journey_id: 'journey-rosa', node_id: 'node-sanctuary', label: 'Safe tonight — Sanctuary SF', order: 1, status: 'complete', date: hrs(-96) },
  { id: 'wp-rosa-3', journey_id: 'journey-rosa', node_id: null, label: 'Got CalFresh', order: 2, status: 'complete', date: hrs(-24) },
  { id: 'wp-rosa-4', journey_id: 'journey-rosa', node_id: null, label: 'Housing assessment scheduled', order: 3, status: 'current', date: hrs(48) },
];

const message = [
  { id: 'msg-maria-1', journey_id: 'journey-maria', sender_role: 'volunteer', body: "Hi Maria — I'm Amara, I'll walk this with you. There's a bed held at Next Door tonight.", created_at: mins(-2910) },
  { id: 'msg-maria-2', journey_id: 'journey-maria', sender_role: 'person', body: 'thank you. what do i bring?', created_at: mins(-2892) },
  { id: 'msg-maria-3', journey_id: 'journey-maria', sender_role: 'volunteer', body: "Just yourself. Intake is open now — they're expecting you.", created_at: mins(-2880) },
];

const foresight_alert = [
  { id: 'alert-tenderloin', area: 'Tenderloin', rationale: 'Cold front tonight (low 42°F, rain), shelter waitlist up 18% this week, and 311 homeless-concern reports clustering near Ellis & Jones. Recommend pre-positioning 30 overflow mats.', severity: 'warning', created_at: hrs(-1) },
];

// --- insert in FK-safe order ------------------------------------------------
const ORDER: Array<[string, unknown[]]> = [
  ['person', person],
  ['volunteer', volunteer],
  ['resource_node', resource_node],
  ['journey', journey],
  ['need', need],
  ['waypoint', waypoint],
  ['message', message],
  ['foresight_alert', foresight_alert],
];

async function upsert(table: string, rows: unknown[]) {
  // "order" is a reserved word but PostgREST takes it as a normal JSON key.
  const res = await fetch(`${URL}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      'Content-Type': 'application/json',
      Prefer: 'resolution=merge-duplicates,return=minimal',
    },
    body: JSON.stringify(rows),
  });
  if (!res.ok) {
    throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`);
  }
}

async function main() {
  console.log('\nSeeding live Supabase →', new global.URL(URL).host, '\n' + '─'.repeat(50));
  for (const [table, rows] of ORDER) {
    try {
      await upsert(table, rows);
      console.log(`  ✓ ${table.padEnd(16)} ${rows.length} rows`);
    } catch (err) {
      console.error(`  ✗ ${table.padEnd(16)} ${err instanceof Error ? err.message : err}`);
      process.exitCode = 1;
      return;
    }
  }
  console.log('─'.repeat(50));
  console.log('✓ Seed complete.');
}

main();
