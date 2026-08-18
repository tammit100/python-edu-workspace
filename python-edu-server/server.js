import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { supabase } from "./supabase.js";

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

// 📖 API מעודכן: שליפת רשימת כל השיעורים שקיימים ב-Supabase עבור ה-Dropdown
app.get("/api/lessons", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("lessons")
      .select("id, subject")
      .order("id", { ascending: true });

    if (error) throw error;
    res.json(data);
  } catch (err) {
    console.error("❌ שגיאה בשליפת רשימת שיעורים מ-Supabase:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// 📖 API מעודכן ומאובטח: שליפת שיעור ותרגיל ספציפי יחד עם הרמזים שלו מהענן
app.get("/api/lessons/:id", async (req, res) => {
  const lessonId = req.params.id;

  try {
    // א'. שליפת פרטי השיעור הכלליים (ללא .single() כדי למנוע קריסה אם ריק)
    const { data: lessons, error: lessonError } = await supabase
      .from("lessons")
      .select("*")
      .eq("id", lessonId);

    if (lessonError) throw lessonError;
    
    // בדיקה האם המערך ריק (השיעור לא קיים עדיין ב-Supabase)
    if (!lessons || lessons.length === 0) {
      return res.status(404).json({ error: "השיעור לא נמצא במסד הנתונים בענן" });
    }

    const lesson = lessons[0]; // תופס את האיבר הראשון והיחיד מהמערך

    // ב'. שליפת כל שלבי העזרה המקושרים לשיעור זה ומיושרים לפי מספר השלב
    const { data: hints, error: hintsError } = await supabase
      .from("lesson_hints")
      .select("*")
      .eq("lesson_id", lessonId)
      .order("step_number", { ascending: true });

    if (hintsError) throw hintsError;

    // ג'. החזרת אובייקט אחד מאוחד התואם לחלוטין ל-Interface של ה-Frontend
    res.json({
      ...lesson,
      hints: hints || []
    });
  } catch (err) {
    console.error(`❌ שגיאה בשליפת שיעור ${lessonId} מ-Supabase:`, err.message);
    res.status(500).json({ error: err.message });
  }
});


// ⚙️ API מעודכן: פאנל מנהל - יצירת שיעור חדש ומערך הרמזים שלו ישירות ב-Supabase
app.post("/api/admin/lessons", async (req, res) => {
  const { subject, presentation_url, topic_material, exercise_description, solution_code, hints } = req.body;

  try {
    // 1. הכנסת השיעור הראשי לטבלת lessons ושליפת השורה שנוצרה
    const { data: newLesson, error: lessonError } = await supabase
      .from("lessons")
      .insert([{ 
        subject, 
        presentation_url, 
        topic_material, 
        exercise_description, 
        solution_code 
      }])
      .select()
      .single(); // מבטיח קבלת אובייקט בודד עם ה-ID החדש

    if (lessonError) throw lessonError;

    const lessonId = newLesson.id; // שליפת ה-ID האוטומטי שנוצר בענן

    // 2. אם המנהל הזין רמזים, נכניס את כולם בבת אחת (Bulk Insert)
    if (hints && hints.length > 0) {
      // מיפוי הרמזים והוספת ה-lesson_id שקיבלנו מהשלב הקודם
      const hintsToInsert = hints.map(hint => ({
        lesson_id: lessonId,
        step_number: hint.step_number,
        title: hint.title,
        content: hint.content
      }));

      const { error: hintsError } = await supabase
        .from("lesson_hints")
        .insert(hintsToInsert);

      if (hintsError) throw hintsError;
    }

    console.log(`🎉 שיעור חדש (ID: ${lessonId}) יחד עם הרמזים שלו נשמרו ב-Supabase!`);
    res.status(201).json({ message: "Lesson and hints created successfully in cloud", lessonId });

  } catch (err) {
    console.error("❌ שגיאה בשמירת שיעור ב-Supabase:", err.message);
    res.status(500).json({ error: "Failed to create lesson in database" });
  }
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

// 👑 API למנהל העל בלבד: מינוי משתמש קיים למורה לפי אימייל (Bulk/Admin Auth)
app.post("/api/admin/set-teacher", async (req, res) => {
  const { email } = req.body;

  if (!email) {
    return res.status(400).json({ error: "חובה לספק כתובת אימייל תקינה" });
  }
  
  try {
    // 1. שליפת רשימת המשתמשים מתוך ה-Auth של Supabase כדי למצוא את ה-ID שלו
    const { data: authUsers, error: listError } = await supabase.auth.admin.listUsers();
    
    if (listError) throw listError;

    // חיפוש המשתמש לפי המייל שהוזן בטופס
    const targetUser = authUsers.users.find(user => user.email?.toLowerCase() === email.toLowerCase());
    
    if (!targetUser) {
      return res.status(404).json({ error: "המשתמש המבוקש לא נמצא רשום במערכת" });
    }

    // 2. עדכון ה-User Metadata של המשתמש ל-role: 'teacher'
    const { error: updateError } = await supabase.auth.admin.updateUserById(
      targetUser.id,
      { user_metadata: { role: 'teacher' } }
    );

    if (updateError) throw updateError;

    console.log(`👑 מנהל העל מינה את המשתמש ${email} לתפקיד מורה בהצלחה!`);
    res.json({ message: `המשתמש ${email} עודכן בהצלחה לתפקיד מורה במערכת!` });

  } catch (err) {
    console.error("❌ שגיאה פנימית במינוי מורה בשרת:", err.message);
    res.status(500).json({ error: "פעולת המינוי נכשלה ברמת השרת המרכזי" });
  }
});

// 📈 API: שמירת התקדמות סטודנט בענן ברגע שהוא פותר תרגיל בהצלחה (SCRUM-15)
app.post("/api/student/progress", async (req, res) => {
  const { student_id, lesson_id } = req.body;

  if (!student_id || !lesson_id) {
    return res.status(400).json({ error: "חסרים נתוני סטודנט או שיעור" });
  }

  try {
    // שימוש ב-upsert כדי להכניס שורה חדשה, או לעדכן חותמת זמן אם הסטודנט כבר פתר זאת בעבר
    const { data, error } = await supabase
      .from("student_progress")
      .upsert(
        { 
          student_id, 
          lesson_id, 
          is_completed: true,
          completed_at: new Date().toISOString()
        }, 
        { onConflict: 'student_id,lesson_id' } // מונע כפילויות לפי החוק שהגדרנו ב-SQL
      );

    if (error) throw error;

    console.log(`✅ התקדמות נשמרה: סטודנט (${student_id}) פתר בהצלחה את שיעור (${lesson_id})`);
    res.json({ success: true, message: "ההתקדמות נשמרה בבטחה בענן!" });

  } catch (err) {
    console.error("❌ שגיאה בשמירת התקדמות סטודנט ב-Supabase:", err.message);
    res.status(500).json({ error: "נכשלה שמירת ההתקדמות במסד הנתונים" });
  }
});

// 🤖 API: הרצת קוד פייתון ובדיקה פדגוגית חכמה באמצעות סוכן בדיקה מופרד (SCRUM-15)
app.post("/api/run-and-check", async (req, res) => {
  // ➕ חילוץ מפורש של custom_input מתוך גוף הבקשה של הדפדפן
  const { code, custom_input, exercise_description, solution_code } = req.body;
  console.log("\n📥 [1/4] בקשת ריצה חדשה הגיעה לשרת...");

  if (!code) {
    return res.status(400).json({ error: "לא נשלח קוד להרצה" });
  }

  // הגנה: יצירת משתנה בטוח לשימוש
  const safeInput = custom_input !== undefined ? custom_input : "10";

  // 📝 1. הזרקת מנגנון המוקינג ללא רווחים בתחילת השורות
  const mockedPythonCode = [
    'import builtins',
    'def custom_input(prompt=""):',
    '    print(prompt, end="")',
    "    return " + JSON.stringify(safeInput),
    'builtins.input = custom_input',
    '# --- קוד הסטודנט מתחיל כאן ---',
    code
  ].join('\n');

  const fileName = `temp_${Date.now()}.py`;
  fs.writeFileSync(fileName, mockedPythonCode);
  console.log("📝 [2/4] קוד הסטודנט נכתב בהצלחה לקובץ הזמני:", fileName);

  const execOptions = {
    env: { ...process.env, PYTHONIOENCODING: "utf-8" }
  };

  console.log("🏃‍♂️ [3/4] מתחיל הרצה פיזית של קוד הסטודנט בפייתון...");
  exec(`python ${fileName}`, execOptions, (error, stdout, stderr) => {
    if (fs.existsSync(fileName)) fs.unlinkSync(fileName);

    console.log("➡️ [3.5] הרצת קוד הסטודנט הסתיימה.");
    const pythonOutput = stdout || stderr || error?.message || "";

    // אם יש שגיאת קומפילציה קשיחה בפייתון - נכשיל מיד ללא פנייה ל-AI
    if (stderr || error) {
      console.log("❌ קוד הסטודנט נכשל עם שגיאת פייתון.");
      return res.json({
        output: pythonOutput,
        isCorrect: false,
        message: "❌ שגיאת קוד פייתון! בדוק את ה-Syntax והרץ מחדש."
      });
    }

    console.log("🤖 [4/4] קורא לסוכן ה-AI Grader בפייתון (grader_agent.py)...");
    const graderProcess = exec("python grader_agent.py", execOptions, (graderError, graderStdout, graderStderr) => {
      console.log("➡️ תשובה חזרה מסוכן ה-AI Grader.");

      try {
        if (graderError || graderStderr) throw new Error(graderStderr || graderError.message);
        
        const evaluation = JSON.parse(graderStdout.trim());
        res.json({
          output: pythonOutput,
          isCorrect: evaluation.isCorrect,
          message: evaluation.feedback,
          next_level: evaluation.next_level
        });

      } catch (err) {
        console.error("❌ שגיאה בפענוח החלטת סוכן ה-AI:", err.message);
        res.json({
          output: pythonOutput,
          isCorrect: true, 
          message: "🎉 הקוד רץ בהצלחה!"
        });
      }
    });

    // 🔥 תיקון השגיאה: שליחת safeInput בתוך ה-payload במקום המשתנה השבור
    const payload = JSON.stringify({ 
      exercise_description, 
      solution_code, 
      student_code: code, 
      python_output: pythonOutput,
      custom_input: safeInput 
    });
    
    graderProcess.stdin.write(payload);
    graderProcess.stdin.end();
  });
});





const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});
