import React, { useState } from 'react';
import { supabase } from './supabaseClient';

export default function AuthPage() {
  const [isRegister, setIsRegister] = useState<boolean>(false);
  const [email, setEmail] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [successMessage, setSuccessMessage] = useState<string>('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    setSuccessMessage('');
    setLoading(true);

    try {
      if (isRegister) {
        // 🔐 לוגיקת רישום תלמיד חדש ב-Supabase (SCRUM-11)
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            data: {
              role: 'student' // ברירת מחדל לכל נרשם חדש במערכת student / teacher
            }
          }
        });
        if (error) throw error;
        
        // במידה ומוגדר אימות מייל ב-Supabase, נעדכן את המשתמש
        if (data.user && data.session === null) {
          setSuccessMessage('📝 נרשמת בהצלחה! שלחנו לך מייל לאימות החשבון.');
        } else {
          setSuccessMessage('✨ נרשמת והתחברת בהצלחה למערכת!');
        }
      } else {
        // 🔐 לוגיקת התחברות תלמיד קיים ב-Supabase (SCRUM-11)
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err: any) {
      console.error('❌ שגיאת אותנטיקציה:', err.message);
      // תרגום שגיאות נפוצות לעברית פשוטה וברורה לסטודנטים
      if (err.message.includes('Invalid login credentials')) {
        setErrorMessage('חוסר התאמה: המייל או הסיסמה שהקשת אינם נכונים.');
      } else if (err.message.includes('User already registered')) {
        setErrorMessage('משתמש רשום: קיים כבר חשבון במערכת עם כתובת מייל זו.');
      } else {
        setErrorMessage(err.message || 'אופס, משהו השתבש בתהליך ההתחברות.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ 
      position: 'fixed', // 🔥 הופך את הרקע לצף אבסולוטית על כל המסך
      top: 0,
      left: 0,
      width: '100vw',    // 🔥 תופס 100% מרוחב הדפדפן
      height: '100vh',   // 🔥 תופס 100% מגובה הדפדפן
      background: '#1e1e1e', 
      display: 'flex', 
      justifyContent: 'center', 
      alignItems: 'center', 
      zIndex: 9999,      // 🔥 מוודא שזה עוקף ומכסה כל אלמנט אחר
      fontFamily: 'sans-serif' 
    }}>

      <div style={{ background: '#252526', padding: '40px', borderRadius: '12px', width: '100%', maxWidth: '400px', boxShadow: '0 4px 15px rgba(0,0,0,0.5)', border: '1px solid #333', boxSizing: 'border-box', direction: 'rtl' }}>
        
        <h2 style={{ color: '#4fc1ff', textAlign: 'center', marginTop: 0, marginBottom: '25px', fontWeight: 'bold' }}>
          {isRegister ? '🚀 רישום תלמיד חדש' : '🔐 כניסה למערכת למידה'}
        </h2>

        {errorMessage && (
          <div style={{ background: 'rgba(255, 75, 75, 0.1)', color: '#ff4b4b', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', borderRight: '4px solid #ff4b4b' }}>
            {errorMessage}
          </div>
        )}

        {successMessage && (
          <div style={{ background: 'rgba(76, 175, 80, 0.1)', color: '#4caf50', padding: '10px', borderRadius: '6px', fontSize: '0.85rem', marginBottom: '15px', borderRight: '4px solid #4caf50' }}>
            {successMessage}
          </div>
        )}

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
                    {/* שדה אימייל מתוקן */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '5px' }}>כתובת אימייל:</label>
            <input 
              type="email" 
              required 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              style={{ 
                width: '100%', 
                padding: '10px', 
                background: '#1e1e1e', 
                color: 'white', 
                border: '1px solid #555', 
                borderRadius: '6px', 
                boxSizing: 'border-box',
                // 🔥 תיקון הבאג: אילוץ כיוון משמאל לימין לשדות קלט באנגלית
                direction: 'ltr',
                textAlign: 'left'
              }} 
              placeholder="your-email@edu.com" 
            />
          </div>

          {/* שדה סיסמה מתוקן */}
          <div>
            <label style={{ display: 'block', fontSize: '0.85rem', color: '#aaa', marginBottom: '5px' }}>סיסמה מאובטחת:</label>
            <input 
              type="password" 
              required 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              style={{ 
                width: '100%', 
                padding: '10px', 
                background: '#1e1e1e', 
                color: 'white', 
                border: '1px solid #555', 
                borderRadius: '6px', 
                boxSizing: 'border-box',
                // 🔥 תיקון הבאג: אילוץ כיוון משמאל לימין לסיסמה
                direction: 'ltr',
                textAlign: 'left'
              }} 
              placeholder="••••••••" 
              minLength={6} 
            />
          </div>


          <button type="submit" disabled={loading} style={{ background: '#4fc1ff', color: '#1e1e1e', border: 'none', padding: '12px', borderRadius: '6px', fontWeight: 'bold', fontSize: '1rem', cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.2s', marginTop: '10px' }}>
            {loading ? 'מבצע פעולה...' : isRegister ? 'צור חשבון חדש' : 'התחבר עכשיו'}
          </button>
        </form>

        <div style={{ marginTop: '20px', textAlign: 'center', borderTop: '1px solid #333', paddingTop: '15px' }}>
          <span onClick={() => { setIsRegister(!isRegister); setErrorMessage(''); setSuccessMessage(''); }} style={{ color: '#4fc1ff', cursor: 'pointer', fontSize: '0.85rem', textDecoration: 'underline' }}>
            {isRegister ? '이미 רשום במערכת? לחץ להתחברות' : 'תלמיד חדש? לחץ ליצירת חשבון חדש'}
          </span>
        </div>

      </div>
    </div>
  );
}
