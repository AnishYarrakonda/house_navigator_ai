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
