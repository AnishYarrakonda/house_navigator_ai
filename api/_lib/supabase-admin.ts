// Server-side Supabase client for the runtime agents. Uses the service-role key
// (server-only — never VITE_ prefixed) so the agents can read/write the
// blackboard. Falls back to the anon key for a local demo where RLS is off
// (see supabase/schema.sql — RLS is a documented production cut).

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

let cached: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (cached) return cached;
  const url = process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL;
  const key =
    process.env.SUPABASE_SERVICE_ROLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.VITE_SUPABASE_ANON_KEY;
  if (!url || !key) {
    throw new Error(
      "Supabase server env not set: need SUPABASE_URL and " +
        "SUPABASE_SERVICE_ROLE_KEY (server-side, no VITE_ prefix).",
    );
  }
  cached = createClient(url, key, { auth: { persistSession: false } });
  return cached;
}
