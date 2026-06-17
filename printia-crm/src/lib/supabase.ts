import { createClient } from '@supabase/supabase-js';

// Puxando as chaves de forma segura do .env (ou da Vercel)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);
