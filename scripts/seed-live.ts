/**
 * Seed the live Supabase project with the REAL San Francisco resource nodes
 * (the same set the in-memory mock uses — single source of truth in
 * src/lib/data/seed.ts), via the REST API (anon key; RLS is off for the demo).
 *
 *   npx tsx scripts/seed-live.ts
 *
 * The two-mode rebuild (Find help / Volunteer) has NO scripted demo theater:
 * resource LOCATIONS are real, verifiable SF services (capacity_open is
 * SIMULATED — SF publishes no public per-bed feed). This script:
 *   1. upserts the real resource_node set + the demo volunteers, and
 *   2. clears the OLD scripted demo rows (fake needs/journeys/messages/etc.)
 *      so the live map shows only real places + whatever real users create.
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';
import { seedNodes, seedVolunteers } from '../src/lib/data/seed';

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

const headers = {
  apikey: KEY,
  Authorization: `Bearer ${KEY}`,
  'Content-Type': 'application/json',
};

async function upsert(table: string, rows: unknown[]) {
  const res = await fetch(`${URL}/rest/v1/${table}?on_conflict=id`, {
    method: 'POST',
    headers: { ...headers, Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`);
}

/** Delete every row in a table (clears stale demo theater). `id=not.is.null`
 *  matches all rows; PostgREST requires a filter for a bulk DELETE. */
async function clearAll(table: string) {
  const res = await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
    method: 'DELETE',
    headers: { ...headers, Prefer: 'return=minimal' },
  });
  if (!res.ok) throw new Error(`${table}: HTTP ${res.status} — ${await res.text()}`);
}

async function main() {
  const clean = process.argv.includes('--clean');
  console.log('\nSeeding live Supabase →', new global.URL(URL).host, '\n' + '─'.repeat(50));

  // 1. (opt-in) Clear scripted demo theater (FK-safe order). DESTRUCTIVE — only
  //    runs with `--clean`. The new product creates needs/journeys from real
  //    use; we don't pre-seed any, so this just removes the old fake beacons.
  if (clean) {
    for (const table of ['message', 'waypoint', 'need', 'journey', 'foresight_alert']) {
      try {
        await clearAll(table);
        console.log(`  ✓ cleared ${table}`);
      } catch (err) {
        console.error(`  ✗ clear ${table}: ${err instanceof Error ? err.message : err}`);
        process.exitCode = 1;
        return;
      }
    }
  }

  // 2. Upsert the real resource nodes + volunteers.
  const resource_node = seedNodes.map((n) => ({
    id: n.id,
    name: n.name,
    type: n.type,
    lat: n.lat,
    lng: n.lng,
    capacity_total: n.capacity_total,
    capacity_open: n.capacity_open,
    hours: n.hours ?? null,
    notes: n.notes ?? null,
  }));
  const volunteer = seedVolunteers.map((v) => ({
    id: v.id,
    name: v.name,
    skills: v.skills,
    active: v.active,
  }));

  for (const [table, rows] of [
    ['volunteer', volunteer],
    ['resource_node', resource_node],
  ] as Array<[string, unknown[]]>) {
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
  console.log('✓ Seed complete —', resource_node.length, 'real SF nodes live.');
}

main();
