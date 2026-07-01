import { createClient } from "@supabase/supabase-js";

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

function hasRealSupabaseConfig(url?: string, anonKey?: string) {
  const cleanUrl = url?.trim() ?? "";
  const cleanKey = anonKey?.trim() ?? "";
  if (!cleanUrl || !cleanKey) return false;
  if (cleanUrl.includes("seu-projeto.supabase.co")) return false;
  if (cleanKey === "sua-chave-anon-publica") return false;
  return cleanUrl.startsWith("https://") && cleanKey.length > 30;
}

export const isSupabaseConfigured = hasRealSupabaseConfig(supabaseUrl, supabaseAnonKey);

export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl!, supabaseAnonKey!, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    })
  : null;

export function requireSupabase() {
  if (!supabase) {
    throw new Error("Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY.");
  }
  return supabase;
}
