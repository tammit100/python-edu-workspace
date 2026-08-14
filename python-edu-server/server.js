import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import db from "./database.js";

const app = express();
app.use(cors());
app.use(express.json());

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 1. ה-API הקיים להרצת הקוד של הסטודנט (נשאר אותו דבר)
app.post('/api/run', (req, res) => {
    const { code } = req.body;
    if (!code) return res.status(400).json({ error: "No code provided" });

    const tempFilePath = path.join(__dirname, 'temp_code.py');
    fs.writeFile(tempFilePath, code, (err) => {
        if (err) return res.status(500).json({ error: "Failed to write temporary file" });

        exec(`python "${tempFilePath}"`, (error, stdout, stderr) => {
            fs.unlink(tempFilePath, () => {});
            if (stderr) return res.json({ output: stderr });
            res.json({ output: stdout || "The code ran successfully." });
        });
    });
});

// 🔥 2. ה-API החדש: חיבור הדפדפן לסוכן ה-AI ב-Python
app.post('/api/chat', (req, res) => {
    const { message, code } = req.body; // מקבלים גם את ההודעה וגם את הקוד הנוכחי בעורך!

    if (!message) return res.status(400).json({ error: "No message provided" });

    // נתיב לקובץ הסוכן האמיתי שלך (ודא שקובץ agent.py נמצא במיקום נכון, נניח באותה תיקייה או תיקיית אב)
    // לצורך הפשטות, נניח שאתה שם את קבצי הסוכן בתוך תיקיית ה-backend או תיקייה ליד
    const agentScriptPath = path.join(__dirname, 'agent.py'); 

    // אנחנו מעבירים לסוכן את השאלה של הסטודנט ואת הקוד שלו כארגומנטים בשורת הפקודה
    // כדי שהסוכן יוכל לקרוא את שניהם
    const payload = JSON.stringify({ message, code });
    
    // הרצת סוכן הפייתון עם המידע
    // הערה: נצטרך לעדכן קלות את agent.py שיקבל ארגומנטים, נעשה זאת מיד בשלב הבא
    const escapedPayload = payload.replace(/"/g, '\\"'); // סינון גרשיים לטרמינל
    
    exec(`python "${agentScriptPath}" "${escapedPayload}"`, (error, stdout, stderr) => {
        if (stderr) {
            console.error("Agent Error:", stderr);
            return res.json({ response: "מצטער, הייתה לי שגיאה פנימית בהבנת הבקשה." });
        }
        
        try {
            // החזרת התשובה שהסוכן הדפיס
            res.json({ response: stdout.trim() });
        } catch (e) {
            res.json({ response: "לא הצלחתי לעבד את תגובת הסוכן." });
        }
    });
});

// ✅ קודם כל: שליפת רשימת כל השיעורים שקיימים ב-DB (עבור ה-Dropdown)
app.get("/api/lessons", (req, res) => {
  db.all("SELECT id, subject FROM lessons ORDER BY id ASC", [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: err.message });
    }
    res.json(rows);
  });
});

// 📖 API חדש: שליפת שיעור ותרגיל יחד עם כל שלבי העזרה שלו מה-DB
app.get("/api/lessons/:id", (req, res) => {
  const lessonId = req.params.id;

  // 1. שליפת פרטי השיעור הכלליים
  db.get("SELECT * FROM lessons WHERE id = ?", [lessonId], (err, lesson) => {
    if (err) return res.status(500).json({ error: err.message });
    if (!lesson) return res.status(404).json({ error: "השיעור לא נמצא" });

    // 2. שליפת כל שלבי העזרה המקושרים לשיעור זה ומיושרים לפי מספר השלב
    db.all("SELECT * FROM lesson_hints WHERE lesson_id = ? ORDER BY step_number ASC", [lessonId], (err, hints) => {
      if (err) return res.status(500).json({ error: err.message });

      // החזרת אובייקט אחד מאוחד המכיל את השיעור ואת מערך הרמזים הדינמי שלו!
      res.json({
        ...lesson,
        hints: hints
      });
    });
  });
});

// ⚙️ API חדש: פאנל מנהל - יצירת שיעור חדש ומערך הרמזים שלו בטרנזקציה אחת
app.post("/api/admin/lessons", (req, res) => {
  const { subject, presentation_url, topic_material, exercise_description, solution_code, hints } = req.body;

  //console.log(`subject ${subject}\ntopic_material ${topic_material}\nexercise_description ${exercise_description}\nsolution_code ${solution_code}`);
  // 1. שימוש ב-serialize כדי להבטיח ביצוע סדרתי ותקין של שאילתות ה-SQLite
  db.serialize(() => {
    // פתיחת טרנזקציה (מונע מצב ששיעור יישמר ללא הרמזים שלו במקרה של תקלה)
    db.run("BEGIN TRANSACTION");

    const lessonSql = `
      INSERT INTO lessons (subject, presentation_url, topic_material, exercise_description, solution_code)
      VALUES (?, ?, ?, ?, ?)
    `;

    // 2. הכנסת השיעור הראשי לטבלת 
    db.run(lessonSql, [subject, presentation_url, topic_material, exercise_description, solution_code], function (err) {
      if (err) {
        console.error("❌ שגיאה בהכנסת שיעור ל-DB:", err.message);
        db.run("ROLLBACK");
        return res.status(500).json({ error: "Failed to create lesson" });
      }

      const lessonId = this.lastID; // שליפת ה-ID הייחודי של השיעור שנוצר זה עתה

      // אם מנהל המערכת לא הזין רמזים בכלל, נסגור את הטרנזקציה ונסיים
      if (!hints || hints.length === 0) {
        db.run("COMMIT");
        return res.status(201).json({ message: "Lesson created successfully", lessonId });
      }

            // 3. הכנה מראש של שאילתת הכנסת הרמזים לביצוע מהיר (Prepared Statement)
      const hintSql = `
        INSERT INTO lesson_hints (lesson_id, step_number, title, content)
        VALUES (?, ?, ?, ?)
      `;
      const insertHint = db.prepare(hintSql);

      let hasError = false;

      // 4. ריצה על כל הרמזים שהגיעו מה-Frontend והזרקתם ל-DB
      hints.forEach((hint) => {
        insertHint.run([lessonId, hint.step_number, hint.title, hint.content], (hintErr) => {
          if (hintErr) {
            console.error("❌ שגיאה בהכנסת רמז ל-DB:", hintErr.message);
            hasError = true;
          }
        });
      });

      // סגירת אובייקט ה-Statement המשוריין
      insertHint.finalize((finalizeErr) => {
        // אם משהו השתבש במהלך הלולאה או הפינאליזציה - נבצע ביטול מלא
        if (hasError || finalizeErr) {
          db.run("ROLLBACK");
          return res.status(500).json({ error: "Failed to insert lesson hints" });
        }

        // אם הכל עבר בשלום, ננעל את השינויים בדיסק הקשיח (Save)
        db.run("COMMIT", (commitErr) => {
          if (commitErr) {
            db.run("ROLLBACK");
            return res.status(500).json({ error: "Failed to commit transaction" });
          }
          
          console.log(`🎉 שיעור חדש (ID: ${lessonId}) יחד עם ${hints.length} רמזים נשמרו ב-DB!`);
          res.status(201).json({ message: "Lesson and hints created successfully", lessonId });
        });
      });
    });
  });
});

// 🤖 API חדש: סוכן ה-AI למרצים - מחולל תרגילים ורמזים פדגוגיים אוטומטית
app.post('/api/admin/generate-lesson', (req, res) => {
    const { subject } = req.body;
    if (!subject) return res.status(400).json({ error: "No subject provided" });

    // נתיב לקובץ הסוכן החדש של המרצה
    const adminAgentPath = path.join(__dirname, 'admin_agent.py'); 

    // אריזת הנושא ב-JSON נקי כדי להעבירו בצורה מאובטחת לסוכן הפייתון
    const payload = JSON.stringify({ subject });
    const escapedPayload = payload.replace(/"/g, '\\"'); // סינון גרשיים לטרמינל ללא שבירת JSON

    console.log(`🤖 מפעיל את סוכן המרצים עבור הנושא: "${subject}"...`);

    // הרצת סוכן הפייתון שמחולל את השיעור
    exec(`python "${adminAgentPath}" "${escapedPayload}"`, (error, stdout, stderr) => {
        if (stderr) {
            console.error("❌ שגיאה בסוכן המרצים של פייתון:", stderr);
            return res.status(500).json({ error: "סוכן ה-AI הפנימי נתקל בשגיאה במהלך הייצור." });
        }
        
        try {
            // פענוח ה-JSON הסטרוקטורלי שהודפס על ידי סוכן הפייתון
            const generatedData = JSON.parse(stdout.trim());
            
            // שליחת המידע המובנה חזרה ל-Frontend (תיאור, פתרון ומערך הרמזים)
            res.json(generatedData);
        } catch (e) {
            console.error("❌ שגיאת פענוח JSON מפלט הסוכן:", stdout);
            res.status(500).json({ error: "לא הצלחתי לפענח את מבנה התשובה של סוכן ה-AI." });
        }
    });
});


const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});
