// useCrewStream — drives the live "AI crew" reasoning panel for the Find-help
// match step. POSTs to the streaming SSE endpoint `/api/crew` and reads the
// stream incrementally with fetch + a ReadableStream reader, parsing one JSON
// object per `data:` line and tolerating partial chunks across reads.
//
// Three agents reason and hand off in order: Scout → Analyst → Presenter. The
// hook exposes progressive per-agent state (status + streamed text), the current
// handoff (drives the arrow), and the final three picks (CrewResult).
//
// Graceful fallback (HARD requirement): if `/api/crew` is unreachable, returns
// non-200, or isn't an event-stream (plain `npm run dev` with no serverless
// functions, or a network error), we DON'T break — we animate short synthetic
// narration for the three agents (staggered with handoffs) and resolve with the
// local heuristic `localMatches(...)`. The demo always produces three options
// and a moving panel.
//
// Privacy: only the person's words + the FUZZED cell + public resource rows are
// sent. No precise point, no PII.

import { useCallback, useRef, useState } from "react";
import { localMatches, type MatchResult, type MatchPick } from "../../lib/match";
import type { ResourceNode } from "../../types";

export type AgentId = "scout" | "analyst" | "presenter";
export type AgentStatus = "pending" | "active" | "done";

export interface AgentState {
  id: AgentId;
  status: AgentStatus;
  /** Localized-ready short label, e.g. "Scout". Set from the stream's title. */
  title: string;
  /** One-line plain blurb of what this agent is doing. */
  blurb: string;
  /** Accumulated streamed reasoning text (the verbose, secondary detail). */
  text: string;
}

export interface Handoff {
  from: AgentId;
  to: AgentId;
  summary: string;
}

/** Shape the server's CrewResult uses (mirrors api/crew.ts CrewPick). */
interface CrewPick {
  node_id: string;
  why: string;
  score: number;
  resourceScore: number;
  distanceMeters: number;
  etaMinutes: number;
}
interface CrewResult {
  closest: CrewPick | null;
  mostResources: CrewPick | null;
  balanced: CrewPick | null;
}

export const AGENT_ORDER: AgentId[] = ["scout", "analyst", "presenter"];

function initialAgents(): Record<AgentId, AgentState> {
  return {
    scout: { id: "scout", status: "pending", title: "Scout", blurb: "", text: "" },
    analyst: { id: "analyst", status: "pending", title: "Analyst", blurb: "", text: "" },
    presenter: { id: "presenter", status: "pending", title: "Presenter", blurb: "", text: "" },
  };
}

export interface CrewStreamState {
  agents: Record<AgentId, AgentState>;
  handoff: Handoff | null;
  running: boolean;
}

export interface UseCrewStream extends CrewStreamState {
  /** Kick off the crew. Resolves with the three picks (always non-throwing). */
  run: (
    words: string,
    fuzzedGeocell: string,
    resources: ResourceNode[],
  ) => Promise<MatchResult>;
  /** Reset the panel back to its idle state. */
  reset: () => void;
}

/** Map a CrewPick (or null) to our MatchPick shape. Identical fields today, but
 * keeps the client decoupled from the server type. */
function toMatchPick(p: CrewPick | null): MatchPick | null {
  if (!p) return null;
  return {
    node_id: p.node_id,
    why: p.why,
    score: p.score,
    resourceScore: p.resourceScore,
    distanceMeters: p.distanceMeters,
    etaMinutes: p.etaMinutes,
  };
}

function toMatchResult(r: CrewResult): MatchResult {
  return {
    closest: toMatchPick(r.closest),
    mostResources: toMatchPick(r.mostResources),
    balanced: toMatchPick(r.balanced),
  };
}

const sleep = (ms: number) => new Promise<void>((res) => setTimeout(res, ms));

export function useCrewStream(): UseCrewStream {
  const [agents, setAgents] = useState<Record<AgentId, AgentState>>(initialAgents);
  const [handoff, setHandoff] = useState<Handoff | null>(null);
  const [running, setRunning] = useState(false);
  // Guard so a late stream from a cancelled run can't write state.
  const runIdRef = useRef(0);

  const reset = useCallback(() => {
    runIdRef.current += 1;
    setAgents(initialAgents());
    setHandoff(null);
    setRunning(false);
  }, []);

  const patchAgent = useCallback(
    (id: AgentId, patch: Partial<AgentState>) => {
      setAgents((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
    },
    [],
  );

  const appendToken = useCallback((id: AgentId, text: string) => {
    setAgents((prev) => ({
      ...prev,
      [id]: { ...prev[id], text: prev[id].text + text },
    }));
  }, []);

  const run = useCallback(
    async (
      words: string,
      fuzzedGeocell: string,
      resources: ResourceNode[],
    ): Promise<MatchResult> => {
      const myRun = ++runIdRef.current;
      const live = () => runIdRef.current === myRun;

      setAgents(initialAgents());
      setHandoff(null);
      setRunning(true);

      try {
        const result = await streamCrew(
          words,
          fuzzedGeocell,
          resources,
          {
            onAgentStart: (id, title, blurb) => {
              if (!live()) return;
              patchAgent(id, { status: "active", title, blurb });
            },
            onToken: (id, text) => {
              if (!live()) return;
              appendToken(id, text);
            },
            onHandoff: (h) => {
              if (!live()) return;
              patchAgent(h.from, { status: "done" });
              setHandoff(h);
            },
          },
        );
        if (!live()) return toMatchResult(result);
        // Mark every agent done once the result lands.
        AGENT_ORDER.forEach((id) => patchAgent(id, { status: "done" }));
        setRunning(false);
        return toMatchResult(result);
      } catch {
        // Unreachable / non-stream / network error → synthetic narration +
        // local heuristic. Never throws; the demo always moves.
        if (!live()) return localMatches(words, fuzzedGeocell, resources);
        const result = await runSynthetic(
          words,
          fuzzedGeocell,
          resources,
          { patchAgent, appendToken, setHandoff, live },
        );
        if (live()) setRunning(false);
        return result;
      }
    },
    [patchAgent, appendToken],
  );

  return { agents, handoff, running, run, reset };
}

// --- Real SSE streaming -----------------------------------------------------

interface StreamCallbacks {
  onAgentStart: (id: AgentId, title: string, blurb: string) => void;
  onToken: (id: AgentId, text: string) => void;
  onHandoff: (h: Handoff) => void;
}

/** POST /api/crew and read the SSE stream. Throws on any non-stream condition so
 * the caller can fall back. Resolves with the final CrewResult. */
async function streamCrew(
  words: string,
  fuzzedGeocell: string,
  resources: ResourceNode[],
  cb: StreamCallbacks,
): Promise<CrewResult> {
  const res = await fetch("/api/crew", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ words, fuzzed_geocell: fuzzedGeocell, resources }),
  });

  const ctype = res.headers.get("content-type") ?? "";
  if (!res.ok || !res.body || !ctype.includes("text/event-stream")) {
    throw new Error(`crew stream unavailable (${res.status} ${ctype})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  let result: CrewResult | null = null;
  let errored: string | null = null;

  // Parse SSE line-by-line. Each `data:` line carries one JSON object.
  const handleLine = (line: string) => {
    const trimmed = line.trimStart();
    if (!trimmed.startsWith("data:")) return;
    const payload = trimmed.slice(5).trim();
    if (!payload || payload === "[DONE]") return;
    let evt: unknown;
    try {
      evt = JSON.parse(payload);
    } catch {
      return; // tolerate a partial / malformed line
    }
    dispatchEvent(evt as Record<string, unknown>);
  };

  function dispatchEvent(evt: Record<string, unknown>) {
    switch (evt.type) {
      case "agent_start":
        cb.onAgentStart(
          evt.agent as AgentId,
          String(evt.title ?? ""),
          String(evt.blurb ?? ""),
        );
        break;
      case "token":
        cb.onToken(evt.agent as AgentId, String(evt.text ?? ""));
        break;
      case "handoff":
        cb.onHandoff({
          from: evt.from as AgentId,
          to: evt.to as AgentId,
          summary: String(evt.summary ?? ""),
        });
        break;
      case "result":
        result = evt.result as CrewResult;
        break;
      case "error":
        errored = String(evt.message ?? "crew error");
        break;
      case "done":
        break;
      default:
        break;
    }
  }

  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    // SSE events are separated by blank lines, but we parse per-line so a
    // streamed token arrives the instant its line completes.
    let nl: number;
    while ((nl = buffer.indexOf("\n")) >= 0) {
      const line = buffer.slice(0, nl);
      buffer = buffer.slice(nl + 1);
      handleLine(line);
    }
  }
  // Flush any trailing line.
  if (buffer.length) handleLine(buffer);

  if (errored && !result) throw new Error(errored);
  if (!result) throw new Error("crew stream ended without a result");
  return result;
}

// --- Synthetic fallback narration -------------------------------------------

interface SyntheticDeps {
  patchAgent: (id: AgentId, patch: Partial<AgentState>) => void;
  appendToken: (id: AgentId, text: string) => void;
  setHandoff: (h: Handoff) => void;
  live: () => boolean;
}

// Short, calm canned lines. These are intentionally generic so they read fine
// in either fallback case. (User-facing crisis copy stays in i18n; this verbose
// reasoning is the secondary "see how we're deciding" detail, kept brief.)
const SYNTH: Record<AgentId, { title: string; blurb: string; lines: string[] }> = {
  scout: {
    title: "Scout",
    blurb: "Reading what you wrote",
    lines: [
      "Reading your words for what you need tonight.",
      "Noting who's with you and anything that matters.",
      "Pulling the open places nearby.",
    ],
  },
  analyst: {
    title: "Analyst",
    blurb: "Weighing the options",
    lines: [
      "Comparing distance, open spots, and hours.",
      "Ranking the closest and the roomiest.",
      "Finding a good balance of both.",
    ],
  },
  presenter: {
    title: "Presenter",
    blurb: "Writing it up plainly",
    lines: [
      "Picking the clearest three options.",
      "Writing each in plain, warm words.",
    ],
  },
};

async function runSynthetic(
  words: string,
  fuzzedGeocell: string,
  resources: ResourceNode[],
  deps: SyntheticDeps,
): Promise<MatchResult> {
  const { patchAgent, appendToken, setHandoff, live } = deps;

  const playAgent = async (id: AgentId) => {
    if (!live()) return;
    const def = SYNTH[id];
    patchAgent(id, { status: "active", title: def.title, blurb: def.blurb });
    for (const line of def.lines) {
      await sleep(420);
      if (!live()) return;
      appendToken(id, line + " ");
    }
    await sleep(260);
    if (live()) patchAgent(id, { status: "done" });
  };

  await playAgent("scout");
  if (live()) setHandoff({ from: "scout", to: "analyst", summary: "Found nearby places." });
  await sleep(320);
  await playAgent("analyst");
  if (live()) setHandoff({ from: "analyst", to: "presenter", summary: "Ranked your options." });
  await sleep(320);
  await playAgent("presenter");
  await sleep(200);

  return localMatches(words, fuzzedGeocell, resources);
}
