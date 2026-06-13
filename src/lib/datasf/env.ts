// Read the optional DataSF app token without pulling Node type defs into the
// browser app tree. These fetchers run in three places — the manual test script
// (tsx/Node), potentially the runtime agents (Node), and potentially the Vite
// app (browser) — so we probe both env surfaces. DataSF works without a token;
// it only relaxes rate limits (see .claude/rules/data-sources.md).

export function datasfAppToken(): string | undefined {
  // Vite / browser builds expose env via import.meta.env (VITE_-prefixed).
  const meta = import.meta as unknown as {
    env?: Record<string, string | undefined>;
  };
  const viteToken = meta.env?.VITE_DATASF_APP_TOKEN;
  if (viteToken) return viteToken;

  // Node (script / serverless agent) — reach process via globalThis so we don't
  // need @types/node in the browser tsconfig.
  const proc = (
    globalThis as {
      process?: { env?: Record<string, string | undefined> };
    }
  ).process;
  return proc?.env?.DATASF_APP_TOKEN;
}
