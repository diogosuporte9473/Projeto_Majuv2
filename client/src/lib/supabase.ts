import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.split(' ')[0]?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.split(' ').find(part => part.startsWith('eyJ'))?.trim() || import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  console.error(
    '❌ ERRO: Credenciais do Supabase não encontradas!\n' +
    'Certifique-se de configurar VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY no arquivo .env ou no Vercel.'
  );
}

export const supabase = createClient(supabaseUrl || '', supabaseAnonKey || '');
