// Tiny HTTP helpers for the server-side agent endpoints. The handlers use the
// Web-standard (Request) => Response signature, which the Vercel Node runtime
// (and most serverless platforms) support — no framework dependency needed.

export function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "content-type": "application/json" },
  });
}

export function badRequest(message: string): Response {
  return json({ error: message }, 400);
}

export function serverError(err: unknown): Response {
  const message = err instanceof Error ? err.message : String(err);
  // Surface the message (these are operator-facing agent endpoints), not a stack.
  return json({ error: message }, 500);
}

/** Parse a JSON body, tolerating an empty/missing body (returns {}). */
export async function readJson<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    return {} as T;
  }
}
