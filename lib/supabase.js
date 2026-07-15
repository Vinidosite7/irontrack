import { createClient } from "@supabase/supabase-js";

// Os fallbacks permitem o build passar sem env configurado.
// Em produção, defina NEXT_PUBLIC_SUPABASE_URL e NEXT_PUBLIC_SUPABASE_ANON_KEY
// no .env.local e nas variáveis de ambiente da Vercel.
const url = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co";
const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-anon-key";

export const supabase = createClient(url, anon);
