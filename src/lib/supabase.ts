// Supabase client + typed helpers. The client is only constructed when the env
// vars are present (i.e. live mode); in mock mode this stays null so the app
// runs with no backend. See .claude/rules/code-style.md.

import { createClient, type SupabaseClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/** Null in mock mode (no env). Lane 4 uses this in the live data layer. */
export const supabase: SupabaseClient | null =
  url && anonKey ? createClient(url, anonKey) : null;
