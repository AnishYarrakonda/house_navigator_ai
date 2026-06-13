/**
 * Supabase "doctor" — reports whether live mode is ready WITHOUT printing any
 * secret. Loads .env.local, then prints only booleans / counts / status codes.
 *
 *   npx tsx scripts/check-supabase.ts
 */

import { readFileSync } from 'fs';
import { resolve } from 'path';

// Minimal .env.local loader (no dotenv dependency). Values are never printed.
try {
  const raw = readFileSync(resolve(process.cwd(), '.env.local'), 'utf8');
  for (const line of raw.split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && process.env[m[1]] === undefined) {
      process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
    }
  }
} catch {
  console.error('Could not read .env.local');
}

const url = process.env.VITE_SUPABASE_URL ?? '';
const anon = process.env.VITE_SUPABASE_ANON_KEY ?? '';
const mode = process.env.VITE_DATA_MODE ?? '(unset → mock)';

const TABLES = [
  'resource_node',
  'need',
  'journey',
  'waypoint',
  'message',
  'volunteer',
  'person',
  'foresight_alert',
];

function mask(present: boolean) {
  return present ? 'set ✓' : 'MISSING ✗';
}

async function main() {
  console.log('\nWaypoint Supabase doctor\n' + '─'.repeat(50));
  console.log(`VITE_DATA_MODE          : ${mode}`);
  console.log(`VITE_SUPABASE_URL       : ${mask(!!url)}`);
  console.log(`VITE_SUPABASE_ANON_KEY  : ${mask(!!anon)}`);

  const isPlaceholder =
    !url || url.includes('xxxx') || !/^https:\/\/[a-z0-9]+\.supabase\.co/.test(url);
  if (isPlaceholder) {
    console.log(
      '\n✗ VITE_SUPABASE_URL is empty or still the placeholder.\n' +
        '  Create a project at https://supabase.com → Project Settings → API,\n' +
        '  then put the Project URL + anon key in .env.local.',
    );
    return;
  }
  // Show only the host, never the key.
  console.log(`  project host          : ${new URL(url).host}`);

  if (!anon) {
    console.log('\n✗ anon key missing — cannot query.');
    return;
  }

  // Hit the REST endpoint for each table; HEAD with count tells us if the table
  // exists (200) vs not-created-yet (404/relation does not exist).
  console.log('\nTables (via REST, no rows printed):');
  let created = 0;
  for (const t of TABLES) {
    try {
      const res = await fetch(
        `${url}/rest/v1/${t}?select=id&limit=1`,
        {
          headers: { apikey: anon, Authorization: `Bearer ${anon}` },
        },
      );
      if (res.ok) {
        const countRes = await fetch(
          `${url}/rest/v1/${t}?select=*`,
          {
            method: 'HEAD',
            headers: {
              apikey: anon,
              Authorization: `Bearer ${anon}`,
              Prefer: 'count=exact',
            },
          },
        );
        const range = countRes.headers.get('content-range') ?? '';
        const count = range.split('/')[1] ?? '?';
        console.log(`  ✓ ${t.padEnd(16)} exists  (${count} rows)`);
        created++;
      } else {
        console.log(`  ✗ ${t.padEnd(16)} not found  (HTTP ${res.status})`);
      }
    } catch (err) {
      console.log(
        `  ✗ ${t.padEnd(16)} unreachable: ${err instanceof Error ? err.message : err}`,
      );
    }
  }

  console.log('\n' + '─'.repeat(50));
  if (created === TABLES.length) {
    console.log('✓ Schema applied. Set VITE_DATA_MODE=live and you are good.');
  } else if (created === 0) {
    console.log(
      '✗ No tables yet — apply supabase/setup.sql (schema + seed) to this project.',
    );
  } else {
    console.log(`⚠ Partial: ${created}/${TABLES.length} tables. Re-apply setup.sql.`);
  }
}

main();
