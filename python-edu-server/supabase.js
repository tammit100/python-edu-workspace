import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabaseUrl = process.env.SUPABASE_URL;
// 🔥 שימוש ב-Service Role Key (ולא ב-Anon Key) ב-Backend
// מפתח זה עוקף את חוקי ה-RLS ומאפשר לשרת לנהל את ה-DB בבטחה
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ שגיאה: חסרים משתני סביבה עבור Supabase בקובץ .env");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false, // מכיוון שמדובר בשרת API, אין צורך לשמור סשן מקומי
    autoRefreshToken: false
  }
});

console.log("🗄️ חיבור מנהל ל-Supabase Client אותחל בהצלחה");
