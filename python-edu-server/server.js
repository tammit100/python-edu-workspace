import express from 'express';
import cors from 'cors';
import { exec } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

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

const PORT = 5000;
app.listen(PORT, () => {
    console.log(`🚀 Backend server is running on http://localhost:${PORT}`);
});
