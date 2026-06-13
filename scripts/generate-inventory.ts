/**
 * Dev convenience: regenerate the seed nodes' `notes` (what's available) and a
 * plausible, VARIED capacity for each, using the Claude API. This is OPTIONAL —
 * the committed seed (src/lib/data/seed.ts) is already enriched by hand and is
 * fully deterministic at runtime. This script exists so the inventory copy can
 * be re-rolled in the future without hand-editing every node.
 *
 * WHY simulated: real SF DataSF feeds give a resource's LOCATION + TYPE but no
 * description of what's actually on hand or how much. The app's "most resources"
 * ranking only means something if capacity VARIES across nodes and the notes say
 * what's there. Per .claude/rules/data-sources.md, all such inventory is
 * SIMULATED demo data (SF publishes no public per-bed feed) and is flagged
 * `simulated: true`.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-inventory.ts          # print enriched array to stdout
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-inventory.ts --print  # same
 *
 * Env:
 *   ANTHROPIC_API_KEY   required to actually call Claude. If absent, the script
 *                       explains that the committed seed is already good and exits 0.
 *   WAYPOINT_MODEL      optional model override (default: claude-haiku-4-5-20251001).
 *
 * It loads .env.local (like the other scripts) before reading env.
 */

import { resolve } from "path";

// Load .env.local like the other tsx helpers. dotenv is optional — if it's not
// installed, env vars passed inline (ANTHROPIC_API_KEY=... npx tsx ...) still work.
try {
  const { config } = await import("dotenv");
  config({ path: resolve(process.cwd(), ".env.local") });
} catch {
  // dotenv not installed; rely on the ambient environment.
}

import Anthropic from "@anthropic-ai/sdk";
import { seedNodes } from "../src/lib/data/seed";
import type { ResourceNode, ResourceType } from "../src/types";

const MODEL = process.env.WAYPOINT_MODEL ?? "claude-haiku-4-5-20251001";

/** Plausible capacity ranges per type, so "most resources" varies meaningfully. */
const CAPACITY_RANGE: Record<ResourceType, [number, number]> = {
  bed: [20, 120], // shelter beds/cots
  food: [120, 600], // meals or grocery bags per service
  hygiene: [3, 6], // toilet/shower stalls
  water: [2, 8], // fill stations / fountains
  medical: [40, 100], // appointment slots per day
  "charging-wifi": [25, 120], // outlets / warm seats
};

const TYPE_GUIDANCE: Record<ResourceType, string> = {
  bed: "shelter beds/cots; mention meals, showers, lockers, pets/couples policy where it fits",
  food: "free meals or grocery bags; mention what food, ID policy, dietary/cultural options",
  hygiene: "staffed toilets/showers; mention sinks, needle disposal, hygiene kits, laundry",
  water: "drinking-water fill stations/fountains; mention cups, shade",
  medical: "drop-in clinic slots; mention wound care, meds, mental health, languages",
  "charging-wifi": "charging ports + free wifi; mention warm seating, lockers, restrooms",
};

interface Enriched {
  notes: string;
  capacity_total: number;
  capacity_open: number;
}

async function enrichOne(client: Anthropic, node: ResourceNode): Promise<Enriched> {
  const [lo, hi] = CAPACITY_RANGE[node.type];
  const prompt = [
    `You write short, believable inventory blurbs for a San Francisco crisis-resource map.`,
    `Resource: "${node.name}" (type: ${node.type}). Location hint: ${node.notes ?? node.address ?? "SF"}.`,
    `Write ONE concise sentence (max ~22 words) describing what's available and roughly how much, like: "${TYPE_GUIDANCE[node.type]}".`,
    `Keep the neighborhood/location detail from the hint if present. Be warm and concrete; no marketing fluff.`,
    `Then pick a plausible capacity_total between ${lo} and ${hi}, and a capacity_open that is a believable fraction of it (sometimes 0 = full).`,
    `Reply as strict JSON only: {"notes": string, "capacity_total": number, "capacity_open": number}`,
  ].join("\n");

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 300,
    messages: [{ role: "user", content: prompt }],
  });

  const text = resp.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  const json = text.slice(text.indexOf("{"), text.lastIndexOf("}") + 1);
  const parsed = JSON.parse(json) as Enriched;

  // Clamp into the sane range so a hallucinated number can't break ranking.
  const total = Math.max(lo, Math.min(hi, Math.round(parsed.capacity_total)));
  const open = Math.max(0, Math.min(total, Math.round(parsed.capacity_open)));
  return { notes: String(parsed.notes).trim(), capacity_total: total, capacity_open: open };
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.log(
      "ANTHROPIC_API_KEY not set. Nothing to do — the committed seed " +
        "(src/lib/data/seed.ts) is already enriched by hand and is deterministic " +
        "at runtime. This script is only for re-rolling that copy via Claude.",
    );
    process.exit(0);
  }

  const client = new Anthropic({ apiKey });
  const out: ResourceNode[] = [];

  for (const node of seedNodes) {
    try {
      const e = await enrichOne(client, node);
      out.push({ ...node, ...e, simulated: true });
      console.error(`✓ ${node.name} → ${e.capacity_open}/${e.capacity_total}`);
    } catch (err) {
      console.error(`✗ ${node.name} failed, keeping existing:`, err instanceof Error ? err.message : err);
      out.push({ ...node, simulated: true });
    }
  }

  // Print the enriched array to stdout. A human reviews and pastes into seed.ts
  // (the runtime result must stay deterministic — we don't auto-rewrite the file).
  console.log(JSON.stringify(out, null, 2));
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
