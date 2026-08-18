import fetch from 'node-fetch'; // במידה ואינכם משתמשים ב-node-fetch, Node 18+ תומך ב-fetch גלובלי
import dotenv from 'dotenv';
dotenv.config();

const BASE_URL = "http://localhost:5000";

// פונקציית עזר להרצת טסט מול השרת
async function runTest(testName, payload) {
    console.log(`\n🧪 מריץ בדיקה: ${testName}...`);
    try {
        const response = await fetch(`${BASE_URL}/api/run-and-check`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`שרת החזיר סטטוס שגיאה: ${response.status}`);
        }

        const data = await response.json();
        console.log(`   🔹 פלט פייתון גולמי:\n${data.output.trim() || "   [אין פלט]"}`);
        console.log(`   🔹 החלטת ה-AI Grader (isCorrect): ${data.isCorrect ? "✅ עובר" : "❌ נכשל"}`);
        console.log(`   🔹 משוב מהסוכן (Feedback): "${data.message}"`);
        
        return data;
    } catch (error) {
        console.error(`   🔴 הבדיקה נכשלה טכנית: ${error.message}`);
        return null;
    }
}

// פונקציית הבדיקה הראשית (ה-Sanity Suite)
async function runSanitySuite() {
    console.log("==================================================");
    console.log("🚀 מתחיל סדרת בדיקות שפיות אוטומטית (Sanity Suite) - Python Edu");
    console.log("==================================================");

    // תרחיש א': קוד נכון שעונה על דרישות התרגיל
    const testCaseSuccess = {
        code: `print("שלום עמית")\nprint("אני בן 25")`,
        exercise_description: "כתוב קוד שמציג את השם שלך על המסך (עמית). לאחר מכן, הוסף שורה שמציגה את הגיל שלך (25).",
        solution_code: `print("שלום עמית")\nprint("אני בן 25")`
    };

    // תרחיש ב': קוד שגוי עם פלט שלא קשור למשימה
    const testCaseFail = {
        code: `print("אני אוהב חתולים")`,
        exercise_description: "כתוב קוד שמציג את השם שלך על המסך (עמית). לאחר מכן, הוסף שורה שמציגה את הגיל שלך (25).",
        solution_code: `print("שלום עמית")\nprint("אני בן 25")`
    };

    // 1. הרצת טסט ההצלחה
    const result1 = await runTest("תרחיש א' - קוד סטודנט תקין לחלוטין", testCaseSuccess);
    
    // 2. הרצת טסט הכישלון
    const result2 = await runTest("תרחיש ב' - קוד סטודנט שגוי פדגוגית", testCaseFail);

    // סיכום הדוח לטרמינל
    console.log("\n==================================================");
    console.log("📊 סיכום בדיקות השפיות האוטומטיות:");
    console.log("==================================================");
    
    if (result1 && result1.isCorrect === true && result2 && result2.isCorrect === false) {
        console.log("💚 שפיות המערכת תקינה ב-100%! צינור ה-AI והרצת הקוד עובדים מושלם.");
    } else {
        console.log("⚠️ נמצאו פערים בלוגיקה! יש לבדוק את קובץ grader_agent.py או את נתוני השרת.");
    }
    console.log("==================================================\n");
}

runSanitySuite();
