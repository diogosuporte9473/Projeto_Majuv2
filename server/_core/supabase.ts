import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";

if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
  console.error("[Supabase] CRITICAL: SUPABASE_URL or SUPABASE_ANON_KEY is missing!");
}

export const supabase = createClient(
  ENV.supabaseUrl.trim(),
  ENV.supabaseAnonKey.trim(),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);
