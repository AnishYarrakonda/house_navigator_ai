/**
 * Quick smoke-test for all four DataSF / NWS fetch functions.
 *
 * Usage:
 *   npx tsx scripts/test-datasf.ts
 *
 * Requires a .env.local with DATASF_APP_TOKEN (optional but avoids rate limits).
 * The script loads that file via dotenv before running.
 */

import { config } from 'dotenv';
import { resolve } from 'path';

// Load .env.local from the project root before importing the fetch functions
config({ path: resolve(process.cwd(), '.env.local') });

import { fetchSF311Encampments } from '../src/lib/datasf/sf311';
import { fetchSFPitStops } from '../src/lib/datasf/pit-stops';
import { fetchShelterWaitlist } from '../src/lib/datasf/shelter-waitlist';
import { fetchSFWeather } from '../src/lib/datasf/weather';

// ─── helpers ─────────────────────────────────────────────────────────────────

function section(title: string) {
  console.log(`\n${'─'.repeat(60)}`);
  console.log(`  ${title}`);
  console.log('─'.repeat(60));
}

function ok(label: string, value: unknown) {
  console.log(`✓ ${label}:`);
  console.log(JSON.stringify(value, null, 2));
}

function fail(label: string, err: unknown) {
  console.error(`✗ ${label} FAILED:`);
  console.error(err instanceof Error ? err.message : err);
}

// ─── tests ───────────────────────────────────────────────────────────────────

async function testSF311() {
  section('SF 311 Encampment Reports  [vw6y-z8j6]');
  try {
    const rows = await fetchSF311Encampments({ limit: 5 });
    ok(`Fetched ${rows.length} rows (first item)`, rows[0] ?? '(empty)');
  } catch (err) {
    fail('SF 311', err);
  }
}

async function testPitStops() {
  section('SF Pit Stops  [mr6h-cr3u]');
  try {
    const rows = await fetchSFPitStops({ limit: 5 });
    ok(`Fetched ${rows.length} rows (first item)`, rows[0] ?? '(empty)');

    const withCoords = rows.filter(
      (r) => r.location?.latitude && r.location?.longitude,
    );
    console.log(`  ${withCoords.length}/${rows.length} rows have coordinates`);
  } catch (err) {
    fail('Pit Stops', err);
  }
}

async function testShelterWaitlist() {
  section('HSH Shelter Waitlist  [w4sk-nq57]');
  try {
    const rows = await fetchShelterWaitlist();
    ok(`Fetched ${rows.length} entries (latest)`, rows[0] ?? '(empty)');

    if (rows.length > 1) {
      const dates = rows.map((r) => r.date);
      console.log(`  Date range: ${dates.at(-1)} → ${dates[0]}`);
    }

    if (rows.length === 0) {
      console.warn(
        '  ⚠  No entries parsed — the dataset field names may have changed.',
        '\n     Inspect a raw row and update COUNT_FIELD_CANDIDATES / DATE_FIELD_CANDIDATES in shelter-waitlist.ts.',
      );
    }
  } catch (err) {
    fail('Shelter Waitlist', err);
  }
}

async function testWeather() {
  section('NWS Weather — San Francisco Tonight');
  try {
    const weather = await fetchSFWeather();
    ok('Tonight forecast', weather);
  } catch (err) {
    fail('NWS Weather', err);
  }
}

// ─── run all ─────────────────────────────────────────────────────────────────

(async () => {
  console.log('\nWaypoint DataSF smoke test');
  console.log(
    `DATASF_APP_TOKEN: ${process.env.DATASF_APP_TOKEN ? 'set ✓' : 'not set (rate limits apply)'}`,
  );

  await testSF311();
  await testPitStops();
  await testShelterWaitlist();
  await testWeather();

  console.log(`\n${'─'.repeat(60)}`);
  console.log('  Done');
  console.log('─'.repeat(60));
})();
