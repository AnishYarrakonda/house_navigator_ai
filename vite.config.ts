import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { apiDevServer } from "./vite-plugins/api-dev";

// https://vite.dev/config/  (Vitest config lives in vitest.config.ts)
export default defineConfig({
  // apiDevServer runs the api/*.ts serverless handlers under `npm run dev`
  // (Vercel runs them natively in prod) so road-snapped routing works locally.
  plugins: [react(), apiDevServer()],
});
