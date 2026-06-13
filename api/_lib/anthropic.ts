// Shared Anthropic client for the runtime agents. STUB — Lane 4 builds the four
// agents (Resource / Triage / Navigator / Foresight) on top of this. Server-side
// only: ANTHROPIC_API_KEY must NOT be prefixed with VITE_ (that would leak it to
// the browser). See .claude/rules/ai-agents.md.
//
// Use the latest, most capable Claude model for reasoning-heavy agents. Every
// model input MUST first pass through src/lib/redaction.ts — never hand-assemble
// a prompt from raw rows (privacy invariant).

import Anthropic from "@anthropic-ai/sdk";

/** Default model for reasoning-heavy agents (Triage, Navigator). */
export const DEFAULT_MODEL = "claude-opus-4-8";

/**
 * Lazily construct the client so importing this module doesn't throw when the
 * key is absent (e.g. during the frontend build). Throws only when an agent
 * actually tries to call the API without a key configured.
 */
export function getAnthropic(): Anthropic {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set (server-side only — never VITE_ prefixed).",
    );
  }
  return new Anthropic({ apiKey });
}
