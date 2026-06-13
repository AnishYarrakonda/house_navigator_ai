/**
 * Remove the scripted DEMO data from the live Supabase project, leaving only the
 * real resource nodes (and volunteer profiles). After this, the app shows no
 * fabricated journeys, needs, message threads, or overflow alerts — only real
 * data created by real use.
 *
 *   npx tsx scripts/clean-live.ts
 *
 * Keeps:    resource_node, volunteer
 * Clears:   message, waypoint, journey, need, foresight_alert, person
 * (RLS is off for the demo, so the anon key can delete — see schema header.)
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const env: Record<string, string> = {};
try {
  for (const line of readFileSync(resolve(process.cwd(), ".env.local"), "utf8").split("\n")) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m) env[m[1]] = m[2].replace(/^["']|["']$/g, "");
  }
} catch {
  /* fall through to process.env */
}

const URL = env.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? "";
const KEY = env.VITE_SUPABASE_ANON_KEY ?? process.env.VITE_SUPABASE_ANON_KEY ?? "";
if (!URL || !KEY) {
  console.error("Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY in .env.local");
  process.exit(1);
}

// Delete in FK-safe order (children first).
const TABLES = ["message", "waypoint", "journey", "need", "foresight_alert", "person"];

async function clearTable(table: string): Promise<void> {
  // PostgREST requires a filter on DELETE; `id=not.is.null` matches every row.
  const res = await fetch(`${URL}/rest/v1/${table}?id=not.is.null`, {
    method: "DELETE",
    headers: {
      apikey: KEY,
      Authorization: `Bearer ${KEY}`,
      Prefer: "return=representation",
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`DELETE ${table} failed: ${res.status} ${body}`);
  }
  const rows = (await res.json()) as unknown[];
  console.log(`  cleared ${table}: ${rows.length} row(s)`);
}

async function main() {
  console.log(`Cleaning demo data from ${URL} …`);
  for (const table of TABLES) {
    await clearTable(table);
  }
  console.log("Done. Resource nodes + volunteers kept; demo data removed.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
