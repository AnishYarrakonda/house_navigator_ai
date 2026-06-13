// Minimal ambient declaration for Node's `process` so the server-side agents
// typecheck without pulling in @types/node (not a project dependency). The /api
// code only ever reads env vars off process.env — nothing else from Node.
//
// Server-side env is NEVER prefixed with VITE_ (that would leak it to the
// browser bundle). ANTHROPIC_API_KEY and the Supabase service key live here.
declare const process: {
  env: Record<string, string | undefined>;
};
