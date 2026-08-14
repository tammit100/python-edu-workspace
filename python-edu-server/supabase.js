import dotenv from 'dotenv';
// טוען את המשתנים מיד עם פענוח הקובץ הזה בזיכרון
dotenv.config(); 

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// בדיקת בטיחות אקטיבית
if (!supabaseUrl || !supabaseServiceKey) {
  console.error("❌ שגיאה: חסרים משתני סביבה עבור Supabase בקובץ .env");
  console.error("נמצא URL:", supabaseUrl ? "תקין" : "חסר");
  console.error("נמצא Key:", supabaseServiceKey ? "תקין" : "חסר");
}

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false
  }
});

console.log("🗄️ חיבור מנהל ל-Supabase Client אותחל בהצלחה");
