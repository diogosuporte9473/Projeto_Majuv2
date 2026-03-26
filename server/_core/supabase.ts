import { createClient } from "@supabase/supabase-js";
import { ENV } from "./env.js";

if (!ENV.supabaseUrl) {
  console.error("[Supabase] CRITICAL: SUPABASE_URL is missing!");
}

// Por padrão, o lado do servidor deve usar SERVICE_ROLE para permitir operações server-side
// de forma consistente (bypass de RLS quando configurado).
// Se a chave não existir, fazemos fallback para ANON e avisamos (pode falhar com RLS ativado).
const serverKey =
  ENV.supabaseServiceRoleKey?.trim() ||
  ENV.supabaseAnonKey?.trim() ||
  "";

const usingServiceRole = Boolean(ENV.supabaseServiceRoleKey?.trim());
if (!serverKey) {
  console.error("[Supabase] CRITICAL: missing SUPABASE_SERVICE_ROLE_KEY and SUPABASE_ANON_KEY!");
}
if (!usingServiceRole) {
  console.warn(
    "[Supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. Falling back to SUPABASE_ANON_KEY (may break with RLS enabled)."
  );
}

export const supabase = createClient(
  ENV.supabaseUrl.trim(),
  serverKey.trim(),
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false
    }
  }
);
