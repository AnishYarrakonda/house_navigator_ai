// The redaction chokepoint. ALL model inputs must route through here — never
// hand-assemble a prompt from raw rows. See .claude/rules/privacy.md
// ("No PII reaches the model"). Agents see only: alias, need type, the person's
// free-text words, fuzzed cell, and resource data — never legal names, precise
// coordinates, device tokens, or contact info.

import type { Need, Person, ResourceNode } from "../types";

/** The only person-shaped fields a model is ever allowed to see. */
export interface RedactedNeed {
  display_alias: string;
  type: Need["type"];
  /** The person's own words — the showcase Triage reasoning input. */
  words?: string;
  fuzzed_geocell: string;
}

/** Resource data is public — passed through as-is (no PII to strip). */
export interface RedactedResource {
  id: string;
  name: string;
  type: ResourceNode["type"];
  capacity_total: number;
  capacity_open: number;
  hours?: string;
  notes?: string;
}

export interface RedactForModelInput {
  person: Pick<Person, "display_alias">;
  need: Pick<Need, "type" | "words" | "fuzzed_geocell">;
  resources?: ResourceNode[];
}

export interface RedactedModelInput {
  need: RedactedNeed;
  resources: RedactedResource[];
}

/**
 * Strip everything but the allow-listed fields before any Claude API call.
 * Deliberately whitelist (not blacklist) so a new PII field can never leak by
 * default. Lane 4's /api/* agents MUST call this on every model input.
 */
export function redactForModel(input: RedactForModelInput): RedactedModelInput {
  const { person, need, resources = [] } = input;

  return {
    need: {
      display_alias: person.display_alias,
      type: need.type,
      words: need.words,
      fuzzed_geocell: need.fuzzed_geocell,
    },
    resources: resources.map((r) => ({
      id: r.id,
      name: r.name,
      type: r.type,
      capacity_total: r.capacity_total,
      capacity_open: r.capacity_open,
      hours: r.hours,
      notes: r.notes,
    })),
  };
}
