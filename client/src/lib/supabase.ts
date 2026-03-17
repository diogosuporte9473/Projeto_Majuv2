import { createClient } from '@supabase/supabase-js';

// Helper to sanitize environment variables
const sanitize = (val: string | undefined) => val?.split(' ')[0]?.trim() || '';

const supabaseUrl = sanitize(import.meta.env.VITE_SUPABASE_URL);
const supabaseAnonKey = sanitize(import.meta.env.VITE_SUPABASE_ANON_KEY);

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ CRITICAL: Supabase credentials missing or malformed!\n' +
    'Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel dashboard.'
  );
}

// Ensure the client doesn't crash on invalid URL, but logs clearly
export const supabase = (supabaseUrl && supabaseUrl.startsWith('https://'))
  ? createClient(supabaseUrl, supabaseAnonKey)
  : (null as any);
