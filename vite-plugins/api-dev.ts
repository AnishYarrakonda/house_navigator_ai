// Dev-only Vite plugin: serve the `api/*.ts` serverless functions under
// `npm run dev`. Plain Vite doesn't run Vercel functions, so without this
// `/api/route` (and the agent endpoints) 404 locally and the map silently falls
// back to a curved line instead of a real road-snapped route. On Vercel these
// same handlers run natively, so this middleware is dev-only — no logic drift.
//
// It also loads ALL vars from `.env` / `.env.local` (including the un-prefixed,
// server-only ones like ORS_API_KEY) into process.env so the handlers can read
// them exactly as they do in production.

import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnv, type Plugin } from "vite";

/** The web-standard handler signature every `api/*.ts` default-exports. */
type WebHandler = (req: Request) => Promise<Response>;

export function apiDevServer(): Plugin {
  return {
    name: "waypoint-api-dev",
    apply: "serve",

    config(_config, { mode }) {
      // "" prefix = load every var, not just VITE_*, so server-only secrets
      // (ORS_API_KEY, ANTHROPIC_API_KEY, …) reach the handlers via process.env.
      const env = loadEnv(mode, process.cwd(), "");
      for (const [key, value] of Object.entries(env)) {
        if (process.env[key] === undefined) process.env[key] = value;
      }
    },

    configureServer(server) {
      server.middlewares.use(async (req, res, next) => {
        const rawUrl = req.url ?? "";
        if (!rawUrl.startsWith("/api/")) return next();

        // Resolve `/api/<name>` → `api/<name>.ts`; bail to the next handler if
        // there's no matching function file.
        const path = rawUrl.split("?")[0].replace(/\/+$/, "");
        const name = path.slice("/api/".length);
        if (!name || name.includes("..")) return next();
        const file = resolve(process.cwd(), "api", `${name}.ts`);
        if (!existsSync(file)) return next();

        try {
          const mod = await server.ssrLoadModule(file);
          const handler = mod.default as WebHandler | undefined;
          if (typeof handler !== "function") return next();

          // Adapt the Node request → a web Request the handler expects.
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) {
            if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
            else if (v != null) headers.set(k, v);
          }
          const hasBody = req.method !== "GET" && req.method !== "HEAD";
          let body: Buffer | undefined;
          if (hasBody) {
            const chunks: Buffer[] = [];
            for await (const chunk of req) chunks.push(chunk as Buffer);
            body = chunks.length ? Buffer.concat(chunks) : undefined;
          }
          const proto = (req.headers["x-forwarded-proto"] as string) ?? "http";
          const host = req.headers.host ?? "localhost";
          const request = new Request(`${proto}://${host}${rawUrl}`, {
            method: req.method,
            headers,
            body,
          });

          const response = await handler(request);
          res.statusCode = response.status;
          response.headers.forEach((value, key) => res.setHeader(key, value));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          res.statusCode = 500;
          res.setHeader("content-type", "application/json");
          res.end(
            JSON.stringify({
              error: err instanceof Error ? err.message : String(err),
            }),
          );
        }
      });
    },
  };
}
