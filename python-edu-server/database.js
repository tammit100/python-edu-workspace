import sqlite3 from "sqlite3";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dbPath = path.join(__dirname, "education.db");

// התחברות למסד הנתונים (אם הקובץ לא קיים, הוא ייצר אותו אוטומטית)
const db = new sqlite3.Database(dbPath, (err) => {
  if (err) {
    console.error("❌ שגיאה בחיבור ל-SQLite:", err.message);
  } else {
    console.log("🗄️ מחובר בהצלחה למסד הנתונים SQLite");
  }
});

// אתחול מבנה הטבלאות (Schema)
// 1. יצירת טבלת שיעורים ותרגילים - גרסה מעודכנת הכוללת את שדה חומר הלימוד מראש
db.serialize(() => {
  db.run(`
    CREATE TABLE IF NOT EXISTS lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      subject TEXT NOT NULL,
      presentation_url TEXT,
      topic_material TEXT, -- ➕ השדה החדש הוכנס ישירות להגדרת הטבלה למניעת בעיות סנכרון
      exercise_description TEXT NOT NULL,
      solution_code TEXT
    )
  `);

  // 2. יצירת טבלת שלבי העזרה ההדרגתיים
  db.run(`
    CREATE TABLE IF NOT EXISTS lesson_hints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      lesson_id INTEGER,
      step_number INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      FOREIGN KEY (lesson_id) REFERENCES lessons (id) ON DELETE CASCADE
    )
  `);
});


// פונקציה שממלאת נתוני דמו ראשוניים רק אם הטבלה ריקה
db.serialize(() => {
  db.get("SELECT COUNT(*) as count FROM lessons", (err, row) => {
    if (row && row.count === 0) {
      console.log("📝 מסד הנתונים ריק, מזין נתוני דמו ראשוניים...");
      
      const insertLesson = db.prepare(`
        INSERT INTO lessons (subject, presentation_url, topic_material, exercise_description, solution_code)
        VALUES (?, ?, ?, ?, ?)
      `);
      
      insertLesson.run(
        "שיעור 1: לולאות For בפייתון",
        "https://google.com",
        "כתוב לולאת for שמדפיסה את הריבועים של המספרים מ-1 עד 4 (כלומר: 1, 4, 9, 16).",
        "for i in range(1, 5):\n    print(i * i)",
        function(err) {
          if (err) return console.error(err);
          const lessonId = this.lastID; // תופס את ה-ID של השיעור שנוצר עכשיו
          
          const insertHint = db.prepare(`
            INSERT INTO lesson_hints (lesson_id, step_number, title, content)
            VALUES (?, ?, ?, ?)
          `);
          
          insertHint.run(lessonId, 1, "1. איזה מבנה של לולאה נדרש?", "אנחנו צריכים להשתמש בלולאת for בשילוב עם פונקציית range המובנית כדי לרוץ על מספרים.");
          insertHint.run(lessonId, 2, "2. טווח ה-Range (מאיפה עד איפה?)", "בפייתון הטווח אינו כולל את המספר האחרון! כדי לרוץ מ-1 עד 4, עלינו להגדיר range(1, 5).");
          insertHint.run(lessonId, 3, "3. מה מודפס בתוך הלולאה?", "בתוך גוף הלולאה (שים לב להזחה!), עליך להכפיל את המשתנה בעצמו (i * i) ולהדפיס אותו.");
          insertHint.finalize();
        }
      );
      insertLesson.finalize();
    }
  });
});
db.run(`ALTER TABLE lessons ADD COLUMN topic_material TEXT`, (err) => {
  // אם השדה כבר קיים זו לא שגיאה, הוא פשוט ימשיך הלאה כרגיל
});
export default db;
