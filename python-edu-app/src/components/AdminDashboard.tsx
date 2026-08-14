import { useState } from "react";

interface AdminHint {
  step_number: number;
  title: string;
  content: string;
}

export default function AdminDashboard({ onBackToApp }: { onBackToApp: () => void }) {
  // סטייט לשיעור החדש
  const [topicMaterial, setTopicMaterial] = useState("");
  const [subject, setSubject] = useState("");
  const [presentationUrl, setPresentationUrl] = useState("");
  const [exerciseDescription, setExerciseDescription] = useState("");
  const [solutionCode, setSolutionCode] = useState("");
  
  // סטייט לרמזים זמניים עבור השיעור הנוכחי שנבנה
  const [hints, setHints] = useState<AdminHint[]>([]);
  const [hintTitle, setHintTitle] = useState("");
  const [hintContent, setHintContent] = useState("");
  
  const [statusMessage, setStatusMessage] = useState(""); // 👈 זו השורה הקיימת האחרונה שלך

  // ➕ סטייט חדש לחיווי טעינה בזמן שה-AI מייצר את השיעור
  const [isGenerating, setIsGenerating] = useState(false);

  // ➕ פונקציה חדשה שקוראת ל-AI וממלאת את הטופס אוטומטית
  const handleAiGenerate = async () => {
    if (!subject.trim()) {
      setStatusMessage("❌ אנא הקלד נושא בשדה 'נושא השיעור' כדי שה-AI ידע מה לייצר");
      return;
    }

    setIsGenerating(true);
    setStatusMessage("🤖 סוכן ה-AI בונה עבורך מערך שיעור, תרגיל ורמזים מדורגים...");
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/api/admin/generate-lesson`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subject })
      });
      
      const data = await res.json();
      
      if (res.ok) {
        let aiTopic = data.topic_material || "";
        let aiExercise = data.exercise_description || "";
        const aiSolution = data.solution_code || "";

        // בדיקת בטיחות: האם ה-AI התבלבל ושם את ההוראות בתיאוריה?
        // סימנים: התיאוריה מכילה מילות פתיחה של תרגיל ("צור", "הגדר") והמשימה מכילה קוד ("=")
        const topicLooksLikeInstructions = aiTopic.includes("צור") || aiTopic.includes("הגדר") || aiTopic.includes("כתוב");
        const exerciseLooksLikeCode = aiExercise.includes("=");

        if (topicLooksLikeInstructions && exerciseLooksLikeCode) {
          console.log("🔄 המערכת זיהתה בלבול בין שדות וביצעה החלפה אוטומטית");
          // אנחנו מחליפים: מה שהיה בתיאוריה הופך למשימה
          const temp = aiTopic;
          aiTopic = "הסבר תיאורטי על נושא השיעור (ניתן לערוך כאן)"; // או להשאיר ריק
          aiExercise = temp;
        }

        // ניקוי סופי של קוד משדה המשימה (למקרה שנשאר שם משהו)
        const finalExercise = aiExercise.split('\n')
          .filter((line: string) => {
            const l = line.trim();
            return !l.includes('=') && !l.toLowerCase().includes('print') && !l.includes('(');
          }).join('\n').trim();

        // עדכון הסטייט
        setTopicMaterial(aiTopic);
        setExerciseDescription(finalExercise || aiExercise);
        setSolutionCode(aiSolution);
        setHints(data.hints || []);
        setStatusMessage("✨ השיעור והרמזים חוללו בהצלחה! אתה יכול לערוך או ללחוץ על שמירה למטה.");
      } else {
        setStatusMessage("❌ הסוכן נכשל בייצור השיעור: " + (data.error || "שגיאה פנימית"));
      }
    } catch (error) {
      setStatusMessage("❌ שגיאת תקשורת עם סוכן ה-AI");
    } finally {
      setIsGenerating(false);
    }
  };

  // פונקציה להוספת רמז לרשימה הזמנית בצד הלקוח
  const handleAddHintToList = () => {
    if (!hintTitle.trim() || !hintContent.trim()) return;
    const nextStep = hints.length + 1;
    setHints([...hints, { step_number: nextStep, title: hintTitle, content: hintContent }]);
    setHintTitle("");
    setHintContent("");
  };

  const handleEditHint = (index: number) => {
    const hint = hints[index];
    setHintTitle(hint.title);
    setHintContent(hint.content);
    // הסרת הרמז מהרשימה כדי שיוכל להתווסף מחדש אחרי עריכה
    setHints(hints.filter((_, i) => i !== index));
  };


  // פונקציה לשליחת כל התוכן לשרת ה-Backend
  const handleSaveLesson = async () => {
    if (!subject.trim() || !exerciseDescription.trim()) {
      setStatusMessage("❌ חובה למלא נושא ותיאור תרגיל");
      return;
    }

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const response = await fetch(`${baseUrl}/api/admin/lessons`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,          
          presentation_url: presentationUrl,
          topic_material: topicMaterial,
          exercise_description: exerciseDescription,
          solution_code: solutionCode,
          hints // מערך הרמזים יישלח יחד עם השיעור
        })
      });

      if (response.ok) {
        setStatusMessage("✅ השיעור והרמזים נשמרו בהצלחה ב-DB!");
        // איפוס הטופס
        setSubject("");
        setPresentationUrl("");
        setExerciseDescription("");
        setSolutionCode("");
        setHints([]);
      } else {
        setStatusMessage("❌ שגיאה בשמירת הנתונים בשרת");
      }
    } catch (error) {
      setStatusMessage("❌ שגיאת תקשורת עם השרת");
    }
  };
  return (
    <div style={{ width: "100vw", height: "100vh", backgroundColor: "#1e1e1e", color: "#fff", padding: "30px", boxSizing: "border-box", overflowY: "auto", direction: "rtl", textAlign: "right" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid #333", paddingBottom: "15px", marginBottom: "20px" }}>
        <h2 style={{ color: "#4fc1ff", margin: 0 }}>⚙️ פאנל מנהל מערכת - הוספת תכני לימוד</h2>
        <button onClick={onBackToApp} style={{ background: "#007acc", color: "#fff", border: "none", padding: "10px 20px", borderRadius: "5px", cursor: "pointer", fontWeight: "bold" }}>🔙 חזרה לסביבת הלימוד</button>
      </div>

      {statusMessage && (
        <div style={{ padding: "12px", background: statusMessage.includes("❌") ? "#5a2525" : "#255a25", borderRadius: "6px", marginBottom: "20px", fontWeight: "bold" }}>{statusMessage}</div>
      )}

      <div style={{ display: "flex", gap: "30px", flexWrap: "wrap" }}>
        {/* טופס פרטי שיעור */}
        <div style={{ flex: "1 1 500px", background: "#252526", padding: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ color: "#4caf50", marginTop: 0, marginBottom: "15px" }}>1. פרטי השיעור הכלליים</h3>
          
          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#aaa" }}>נושא השיעור (למשל: לולאות While):</label>
            <input type="text" value={subject} onChange={(e) => setSubject(e.target.value)} style={{ width: "100%", padding: "10px", background: "#1e1e1e", color: "#fff", border: "1px solid #555", borderRadius: "4px", boxSizing: "border-box" }} />
            
            {/* 🤖 כפתור הזרקת ה-AI החדש למרצה שמוצב בדיוק כאן */}
            <button
              type="button"
              disabled={isGenerating}
              onClick={handleAiGenerate}
              style={{
                marginTop: "10px",
                width: "100%",
                padding: "8px 12px",
                background: "linear-gradient(45deg, #a142f5, #4fc1ff)",
                color: "white",
                border: "none",
                borderRadius: "5px",
                cursor: isGenerating ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
                boxShadow: "0 2px 4px rgba(0,0,0,0.3)",
                transition: "all 0.2s"
              }}
            >
              {isGenerating ? "⏳ מייצר תכנים פדגוגיים..." : "✨ ג'נרט שיעור, תרגיל ורמזים אוטומטית עם AI"}
            </button>
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#aaa" }}>קישור למצגת או חומרי לימוד (Google Slides Embed):</label>
            <input type="text" value={presentationUrl} onChange={(e) => setPresentationUrl(e.target.value)} style={{ width: "100%", padding: "10px", background: "#1e1e1e", color: "#fff", border: "1px solid #555", borderRadius: "4px", boxSizing: "border-box" }} />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#aaa" }}>📖 חומר לימוד תיאורטי (הסבר הנושא):</label>
            <textarea value={topicMaterial} onChange={(e) => setTopicMaterial(e.target.value)} rows={4} style={{ width: "100%", padding: "10px", background: "#1e1e1e", color: "#fff", border: "1px solid #555", borderRadius: "4px", boxSizing: "border-box", fontFamily: "sans-serif" }} />
          </div>

          <div style={{ marginBottom: "12px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#aaa" }}>תיאור התרגיל והמשימה לסטודנט:</label>
            <textarea value={exerciseDescription} onChange={(e) => setExerciseDescription(e.target.value)} rows={4} style={{ width: "100%", padding: "10px", background: "#1e1e1e", color: "#fff", border: "1px solid #555", borderRadius: "4px", boxSizing: "border-box", fontFamily: "sans-serif" }} />
          </div>

          <div style={{ marginBottom: "15px" }}>
            <label style={{ display: "block", marginBottom: "5px", fontSize: "0.9rem", color: "#aaa" }}>קוד פתרון רשמי (פייתון):</label>
            <textarea value={solutionCode} onChange={(e) => setSolutionCode(e.target.value)} rows={5} style={{ width: "100%", padding: "10px", background: "#1e1e1e", color: "#4fc1ff", border: "1px solid #555", borderRadius: "4px", boxSizing: "border-box", fontFamily: "monospace", direction: "ltr", textAlign: "left" }} />
          </div>
        </div>

        {/* טופס ניהול רמזים */}
        <div style={{ flex: "1 1 400px", background: "#252526", padding: "20px", borderRadius: "8px", border: "1px solid #333" }}>
          <h3 style={{ color: "#ffb74d", marginTop: 0, marginBottom: "15px" }}>2. בניית שלבי עזרה ורמזים (לפי סדר)</h3>
          
          <div style={{ background: "#1e1e1e", padding: "15px", borderRadius: "6px", marginBottom: "15px", border: "1px solid #444" }}>
            <span style={{ fontSize: "0.8rem", color: "#ffb74d", fontWeight: "bold" }}>הוספת רמז מס' {hints.length + 1}</span>
            <input type="text" placeholder="כותרת הרמז (למשל: הגדרת המונה)" value={hintTitle} onChange={(e) => setHintTitle(e.target.value)} style={{ width: "100%", padding: "8px", background: "#2d2d2d", color: "#fff", border: "1px solid #555", borderRadius: "4px", marginTop: "8px", marginBottom: "8px", boxSizing: "border-box" }} />
            <textarea placeholder="תוכן הרמז המנחה לתלמיד..." value={hintContent} onChange={(e) => setHintContent(e.target.value)} rows={3} style={{ width: "100%", padding: "8px", background: "#2d2d2d", color: "#fff", border: "1px solid #555", borderRadius: "4px", marginBottom: "10px", boxSizing: "border-box" }} />
            <button type="button" onClick={handleAddHintToList} style={{ background: "#ffb74d", color: "#111", border: "none", padding: "6px 12px", borderRadius: "4px", cursor: "pointer", fontWeight: "bold" }}>➕ הוסף רמז לשלב זה</button>
          </div>

          <h5 style={{ margin: "10px 0 5px 0", color: "#aaa" }}>רשימת הרמזים שנוצרו לשיעור זה:</h5>
          {hints.length === 0 ? (
            <p style={{ color: "#666", fontSize: "0.85rem", margin: 0 }}>טרם נוספו רמזים לשיעור זה. מומלץ להוסיף לפחות 2 שלבים.</p>
            ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {hints.map((h, index) => (
                <div key={index} style={{ background: "#151515", padding: "10px", borderRadius: "4px", borderRight: "3px solid #ffb74d" }}>
                    
                    {/* שורה עליונה: כותרת + כפתור עריכה */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
                    <div style={{ fontWeight: "bold", fontSize: "0.85rem", color: "#ffb74d" }}>
                        שלב {h.step_number}: {h.title}
                    </div>
                    
                    <button 
                        onClick={() => handleEditHint(index)} 
                        style={{ background: "none", border: "none", color: "#4fc1ff", cursor: "pointer", fontSize: "0.75rem", textDecoration: "underline" }}
                    >
                        ✏️ ערוך
                    </button>
                    </div>
                    
                    {/* תוכן הרמז - החזרנו אותו לכאן! */}
                    <div style={{ fontSize: "0.82rem", color: "#ccc", lineHeight: "1.4" }}>
                    {h.content}
                    </div>
                    
                </div>
                ))}
            </div>
            )}

        </div>
      </div>

      <div style={{ borderTop: "2px solid #333", marginTop: "30px", paddingTop: "20px", display: "flex", justifyContent: "center" }}>
        <button onClick={handleSaveLesson} style={{ background: "#4caf50", color: "white", border: "none", padding: "15px 40px", fontSize: "1.1rem", borderRadius: "6px", cursor: "pointer", fontWeight: "bold", boxShadow: "0 4px 6px rgba(0,0,0,0.2)" }}>💾 שמור שיעור ורמזים חדשים למסד הנתונים</button>
      </div>
    </div>
  );
}
