import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";

if (!ENV.supabaseUrl || !ENV.supabaseAnonKey) {
  console.warn("[Supabase] SUPABASE_URL or SUPABASE_ANON_KEY is missing in env vars");
}

export const supabase = createClient(
  ENV.supabaseUrl,
  ENV.supabaseAnonKey
);
