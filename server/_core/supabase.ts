import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";

if (!ENV.supabaseUrl) {
  console.error("[Supabase] CRITICAL: SUPABASE_URL is missing!");
}

if (!ENV.supabaseAnonKey) {
  console.error("[Supabase] CRITICAL: SUPABASE_ANON_KEY is missing!");
}

const serverKey =
  ENV.supabaseServiceRoleKey?.trim() ||
  ENV.supabaseAnonKey?.trim() ||
  "";

if (!serverKey) {
  console.error("[Supabase] CRITICAL: missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY!");
}

if (!ENV.supabaseServiceRoleKey?.trim()) {
  console.warn(
    "[Supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Using SUPABASE_ANON_KEY (may break with RLS enabled)."
  );
}

export const supabase = createClient(
  ENV.supabaseUrl.trim(),
  serverKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);
