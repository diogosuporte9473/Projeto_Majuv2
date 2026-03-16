import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn("Supabase URL or Anon Key is missing in environment variables.");
}

// Ensure the URL is valid, otherwise createClient might throw
const finalUrl = supabaseUrl?.startsWith("http") ? supabaseUrl : "https://placeholder.supabase.co";

export const supabase = createClient(
  finalUrl,
  supabaseAnonKey || "placeholder-key"
);
