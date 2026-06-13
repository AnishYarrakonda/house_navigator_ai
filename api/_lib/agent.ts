// Shared Claude tool-use runner for the runtime agents.
//
// Every reasoning agent (Triage / Navigator / Foresight / Resource) returns a
// STRUCTURED result — a ranked list + rationale + confidence, an alert, a plan.
// We get that by forcing a single "submit" tool and reading its typed input,
// rather than parsing free text. This keeps each agent's output explainable and
// machine-persistable (the audit trail in ai-agents.md).
//
// IMPORTANT: the caller must have already routed any person-derived input
// through src/lib/redaction.ts. This runner does not see raw rows; it only
// receives the strings the caller passes — keep them redacted.

import type Anthropic from "@anthropic-ai/sdk";
import { DEFAULT_MODEL, getAnthropic } from "./anthropic";

export interface ToolSpec {
  name: string;
  description: string;
  input_schema: {
    type: "object";
    properties: Record<string, unknown>;
    required?: string[];
  };
}

/**
 * Run one agent turn that MUST answer by calling `tool`, and return the tool's
 * parsed input as T. (Forced tool_choice — so we don't enable thinking, which
 * is incompatible with a forced tool call.)
 */
export async function runToolAgent<T>(opts: {
  system: string;
  user: string;
  tool: ToolSpec;
  maxTokens?: number;
}): Promise<T> {
  const client = getAnthropic();
  const res = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 1500,
    system: opts.system,
    tools: [opts.tool as unknown as Anthropic.Tool],
    tool_choice: { type: "tool", name: opts.tool.name },
    messages: [{ role: "user", content: opts.user }],
  });

  for (const block of res.content) {
    if (block.type === "tool_use" && block.name === opts.tool.name) {
      return block.input as T;
    }
  }
  throw new Error(`Agent did not return a "${opts.tool.name}" tool call`);
}

export interface StreamAgentResult<T> {
  /** The agent's full natural-language narration (also streamed via onToken). */
  narration: string;
  /** The structured handoff payload from the tool call, or null if it didn't call it. */
  data: T | null;
}

/**
 * Run one agent turn that FIRST narrates its reasoning as plain text (streamed
 * token-by-token via `onToken`), THEN hands off a structured payload by calling
 * `tool`. Used by the visible Scout → Analyst → Presenter crew (api/crew.ts) so
 * judges can watch real reasoning stream and the agents hand off to each other.
 *
 * Unlike runToolAgent, this uses tool_choice "auto" so the model is free to emit
 * narration text before the tool call. The system prompt must instruct it to
 * narrate first, then call the tool. If the model skips the tool, `data` is null
 * and the caller falls back to deterministic selection.
 *
 * IMPORTANT: the caller must have already routed person-derived input through
 * src/lib/redaction.ts — this runner only sees the strings it is passed.
 */
export async function streamNarrationThenTool<T>(opts: {
  system: string;
  user: string;
  tool: ToolSpec;
  maxTokens?: number;
  onToken?: (text: string) => void;
}): Promise<StreamAgentResult<T>> {
  const client = getAnthropic();
  const stream = client.messages.stream({
    model: DEFAULT_MODEL,
    max_tokens: opts.maxTokens ?? 800,
    system: opts.system,
    tools: [opts.tool as unknown as Anthropic.Tool],
    tool_choice: { type: "auto" },
    messages: [{ role: "user", content: opts.user }],
  });

  let narration = "";
  stream.on("text", (delta: string) => {
    narration += delta;
    opts.onToken?.(delta);
  });

  const final = await stream.finalMessage();
  let data: T | null = null;
  for (const block of final.content) {
    if (block.type === "tool_use" && block.name === opts.tool.name) {
      data = block.input as T;
      break;
    }
  }
  return { narration, data };
}
