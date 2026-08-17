import { createClient } from '@supabase/supabase-js';

// שימוש במשתני הסביבה של Vite (מתחילים ב-VITE_)
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://mruktdqmgmfzomxhdjiv.supabase.co";
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

console.log("🔗 Supabase Init Test:", {
  url: supabaseUrl,
  hasKey: !!supabaseAnonKey
});

if (!supabaseAnonKey) {
  console.error("⚠️ אזהרה: חסר VITE_SUPABASE_ANON_KEY בקובץ ה-.env של ה-Client");
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey || "");
