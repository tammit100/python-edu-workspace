import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";

import AdminDashboard from "./components/AdminDashboard"; 

interface Hint {
  id: number;
  lesson_id: number;
  step_number: number;
  title: string;
  content: string;
}

interface Lesson {
  id: number;
  subject: string;
  presentation_url: string;
  topic_material: string;
  exercise_description: string;
  solution_code: string;
  hints: Hint[];
}

export default function App() {
  const [currentLesson, setCurrentLesson] = useState<Lesson | null>(null);
  const [code, setCode] = useState<string>("# כתוב את קוד הפייתון שלך כאן\n");
  const [output, setOutput] = useState<string>("הפלט יופיע כאן לאחר לחיצה על Run...");
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [messages, setMessages] = useState<any[]>([
    { id: 1, text: "שלום עמית! אני סוכן ה-AI שלך. במה אוכל לעזור?", sender: "agent" }
  ]);
  const [input, setInput] = useState("");
  
  const [showAgent, setShowAgent] = useState<boolean>(true);
  const [showSyllabus, setShowSyllabus] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  
  // ⚡ מנגנון שלבי עזרה מתקדם: ניהול הרמז הפתוח והרמז המקסימלי שהותר לגישה
  const [activeHintNum, setActiveHintNum] = useState<number | null>(null);
  const [maxUnlockedStep, setMaxUnlockedStep] = useState<number>(1);

  const chatEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [selectedLessonId, setSelectedLessonId] = useState<number>(1);
  const [allLessons, setAllLessons] = useState<{ id: number; subject: string }[]>([]);

  // show solution is lock before the student tries the hints
  const [showSolution, setShowSolution] = useState<boolean>(false);

  // little help - popup / modal to help student
  const [showTopicPopup, setShowTopicPopup] = useState<boolean>(false);
  const [unlockedHintIds, setUnlockedHintIds] = useState<number[]>([]);


  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleEditorDidMount(editor: any) {
    editorRef.current = editor;
  }

  // 1. useEffect חדש שרץ פעם אחת בטעינה ומושך את רשימת כל השיעורים שקיימים
  useEffect(() => {
    const fetchAllLessons = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
        const res = await fetch(`${baseUrl}/api/lessons`); // נתיב חדש שנפתח מיד בשרת
        const data = await res.json();
        setAllLessons(data);
      } catch (error) {
        console.error("❌ שגיאה בטעינת רשימת השיעורים:", error);
      }
    };
    fetchAllLessons();
  }, [currentLesson]); // יתעדכן אוטומטית גם כשחוזרים מפאנל המנהל לאחר הוספה

  // 2. ה-useEffect הקיים שלכם שמושך את השיעור הספציפי שנבחר (נשאר כמעט אותו דבר)
  useEffect(() => {
    const fetchLesson = async () => {
      try {
        const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
        const res = await fetch(`${baseUrl}/api/lessons/${selectedLessonId}`);
        const data = await res.json();

        // 🔥 איפוס שלבי העזרה לפני טעינת השיעור החדש כדי למנוע נעילה או באגים של שיעור קודם
        setActiveHintNum(null);
        setMaxUnlockedStep(1); 
        setShowSolution(false);
        setUnlockedHintIds([]);

        setCurrentLesson(data);
      } catch (error) {
        console.error("❌ שגיאה בטעינת השיעור מה-DB:", error);
      }
    };
    fetchLesson();
  }, [selectedLessonId]);

  const askAIForHelp = (title: string, content: string) => {
    setShowAgent(true);
    
    // ניקוי אגרסיבי של תווים מיוחדים שעלולים לשבור את מפרש ה-JSON של שרת הפייתון
    const cleanTitle = title.replace(/[\\"\n\r]/g, " ");
    const cleanContent = content.replace(/[\\"\n\r]/g, " ");
    const cleanCode = code.replace(/[\\"\n\r]/g, " ");

    // בניית מחרוזת שטוחה ונקייה לחלוטין (טקסט טהור)
    const aiPrompt = "אני צריך עזרה בשלב המשימה: " + cleanTitle + ". " +
                     "בהסבר כתוב: " + cleanContent + ". " +
                     "הנה קוד הפייתון הנוכחי שלי, תוכל לכוון אותי בלי לגלות את הפתרון המלא? " +
                     " קוד סטודנט: " + cleanCode;
                     
    setInput(aiPrompt);
  };


  // 2. תיקון פונקציית שליחת ההודעה הכללית בצ'אט
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg = { id: Date.now(), text: input, sender: "user" };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    
    const typingId = Date.now() + 1;
    setMessages(prev => [...prev, { id: typingId, text: "...הסוכן חושב", sender: "agent" }]);
    
    // ניקוי תווי הבקסלאש (לוכסן הפוך) לפני האריזה ל-JSON כדי למנוע שגיאות Invalid \escape בשרת
    const safeInput = input.replace(/\\/g, "\\\\");
    const safeCode = code.replace(/\\/g, "\\\\");

    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/api/chat`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: safeInput, code: safeCode })
      });
      const data = await res.json();
      setMessages(p => p.map(m => m.id === typingId ? { ...m, text: data.response } : m));
    } catch {
      setMessages(p => p.map(m => m.id === typingId ? { ...m, text: "❌ שגיאת תקשורת" } : m));
    }
  };
  const handleRunCode = async () => {
    setIsLoadingCode(true);
    setOutput("Running Python code...");
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      const res = await fetch(`${baseUrl}/api/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      setOutput(`>>> Python main.py\n${data.output}`);
    } catch {
      setOutput("❌ ודא ששרת ה-Backend רץ בפורט 5000.");
    } finally { setIsLoadingCode(false); }
  };

  // לוגיקת הלחיצה על כפתור רמז משודרג
  const handleHintClick = (hintId: number, stepNumber: number) => {
    // שלב א': שליטה על פתיחה/סגירה של תפריט הרמז הנוכחי במסך
    if (activeHintNum === stepNumber) {
      setActiveHintNum(null);
    } else {
      setActiveHintNum(stepNumber);
      
      // שלב ב': הוספת ה-id של הרמז לרשימת החשיפות בצורה בלתי הפיכה
      if (!unlockedHintIds.includes(hintId)) {
        setUnlockedHintIds(prev => [...prev, hintId]);
      }
    }
  };

  const renderTextWithSmartBreaks = (textBlock: string) => {
    if (!textBlock) return null;
    let clean = textBlock.replace(/\\n/g, "\n");
    
    // הפיכת כל נקודה סופית של משפט המלווה ברווח לירידת שורה כפולה לפסקאות ברורות
    clean = clean.replace(/\.\s+/g, ".\n\n");
    clean = clean.replace(/(:\s+)/g, ":\n");
    
    return (
      <div dir="auto" style={{ textAlign: "right", lineHeight: "1.6", fontSize: "0.92rem", whiteSpace: "pre-wrap" }}>
        {clean}
      </div>
    );
  };


  const renderMessageContent = (text: string) => {
    if (!text.includes("```")) return renderTextWithSmartBreaks(text);
    const parts = text.split("```");
    return parts.map((part, index) => {
      if (index % 2 !== 0) {
        const cleanCode = part.replace(/^python\n/, "");
        return (
          <pre key={index} style={{ background: "#151515", color: "#4fc1ff", padding: "10px", borderRadius: "5px", fontFamily: "monospace", fontSize: "0.85rem", overflowX: "auto", direction: "ltr", textAlign: "left", margin: "10px 0" }}>
            {cleanCode}
          </pre>
        );
      }
      return <div key={index}>{renderTextWithSmartBreaks(part)}</div>;
    });
  };

  if (!currentLesson) {
    return <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1e1e1e", color: "#fff", justifyContent: "center", alignItems: "center" }}>טוען נתונים ממסד הנתונים...</div>;
  }

  if (isAdminView) {
    return <AdminDashboard onBackToApp={() => setIsAdminView(false)} />;
  }

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1e1e1e", color: "#fff", margin: 0, overflow: "hidden" }}>
       {showSyllabus && (
        <div style={{ flex: "0 0 20%", minWidth: "250px", borderRight: "1px solid #333", background: "#252526", display: "flex", flexDirection: "column", padding: "15px", direction: "rtl", height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
          <h3 style={{ color: "#4fc1ff", margin: "0 0 5px 0" }}>📖 סילבוס</h3>
          
          {/* 🔽 מיקום חדש ומשודרג לרשימה הנפתחת של השיעורים */}
                    {/* 🔽 ה-Dropdown המשודרג עם כפתור המידע */}
          <div style={{ marginBottom: "15px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
              <label style={{ fontSize: "0.8rem", color: "#aaa" }}>בחר יחידת לימוד:</label>
              
              {/* כפתור ה-ⓘ שפותח את ההסבר המהיר */}
              <span 
                onClick={() => setShowTopicPopup(true)}
                style={{ cursor: "pointer", fontSize: "0.85rem", color: "#4fc1ff", fontWeight: "bold", textDecoration: "underline" }}
              >
                {/* כפתור ה-ⓘ המשודרג הכולל הגנה מפני קריסה אם השיעור חסר */}
                <span 
                  onClick={() => currentLesson && setShowTopicPopup(true)}
                  style={{ 
                    cursor: currentLesson ? "pointer" : "not-allowed", 
                    fontSize: "0.85rem", 
                    color: currentLesson ? "#4fc1ff" : "#666", 
                    fontWeight: "bold", 
                    textDecoration: currentLesson ? "underline" : "none" 
                  }}
                >
                  ⓘ מה זה {currentLesson?.subject?.includes(':') ? currentLesson.subject.split(':')[1]?.trim() : (currentLesson?.subject || "הנושא")}?
                </span>

              </span>
            </div>

            <select 
              value={selectedLessonId} 
              onChange={(e) => setSelectedLessonId(Number(e.target.value))}
              dir="rtl"
              style={{ width: "100%", padding: "8px", background: "#3c3c3c", color: "white", border: "1px solid #555", borderRadius: "6px", cursor: "pointer", fontSize: "0.85rem", fontWeight: "bold" }}
            >
              {allLessons && allLessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id} dir="rtl" style={{ background: "#2d2d2d", color: "white" }}>
                  {lesson.subject}
                </option>
              ))}
            </select>
          </div>

        <button onClick={() => setShowModal(true)} style={{ color: "#4fc1ff", cursor: "pointer", background: "none", border: "none", textAlign: "right", marginBottom: "15px", padding: 0 }}>🖥️ מצגת שיעור</button>
          
                    {/* 📖 תיבת חומר לימוד ותיאוריה - גרסה מוגנת מקריסות */}
          <div style={{ background: "#1e1e1e", padding: "14px", borderRadius: "8px", marginBottom: "12px", borderRight: "4px solid #4fc1ff", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
            <h5 style={{ margin: "0 0 8px 0", color: "#4fc1ff", fontSize: "0.95rem", fontWeight: "bold" }}>📖 חומר לימוד:</h5>
            {/* 🔥 הוספת סימן שאלה להגנה: currentLesson?.topic_material */}
            {currentLesson?.topic_material ? (
              renderTextWithSmartBreaks(currentLesson.topic_material)
            ) : (
              <div style={{ color: "#aaa", fontSize: "0.85rem" }}>אין חומר לימוד זמין לשיעור זה.</div>
            )}
          </div>

          {/* 🎯 תיבת התרגיל והמשימה - גרסה מוגנת מקריסות */}
          <div style={{ background: "#1e1e1e", padding: "14px", borderRadius: "8px", marginBottom: "15px", borderRight: "4px solid #4caf50", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
            <h5 style={{ margin: "0 0 8px 0", color: "#4caf50", fontSize: "0.95rem", fontWeight: "bold" }}>🎯 משימה לביצוע:</h5>
            <div style={{ 
              margin: 0, 
              fontSize: "0.9rem", 
              lineHeight: "1.6", 
              whiteSpace: "pre-wrap", 
              fontFamily: "monospace",
              color: "#4fc1ff",
              background: "#151515",
              padding: "12px",
              borderRadius: "6px",
              direction: (currentLesson?.exercise_description?.includes("#") || currentLesson?.exercise_description?.includes("=")) ? "ltr" : "rtl",
              textAlign: (currentLesson?.exercise_description?.includes("#") || currentLesson?.exercise_description?.includes("=")) ? "left" : "right"
            }}>
              {/* 🔥 הוספת אופרטור הגנה כדי למנוע קריסה אם המשימה ריקה */}
              {currentLesson?.exercise_description || "אנא בחר או ג'נרט יחידת לימוד בפאנל המנהל."}
            </div>
          </div>

                    {/* 🎯 תיבת התרגיל והמשימה - גרסה מוגנת מקריסות ומיושרת לשמאל לקוד פייתון */}
          <div style={{ background: "#1e1e1e", padding: "14px", borderRadius: "8px", marginBottom: "15px", borderRight: "4px solid #4caf50", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}>
            <h5 style={{ margin: "0 0 8px 0", color: "#4caf50", fontSize: "0.95rem", fontWeight: "bold" }}>🎯 משימה לביצוע:</h5>
            
            <div style={{ 
              margin: 0, 
              fontSize: "0.9rem", 
              lineHeight: "1.6", 
              whiteSpace: "pre-wrap", 
              // 🔥 שימוש ב-?. לפקודתincludes מוגנת
              fontFamily: currentLesson?.exercise_description?.includes("#") ? "monospace" : "sans-serif",
              color: currentLesson?.exercise_description?.includes("#") ? "#4fc1ff" : "#ffffff",
              background: currentLesson?.exercise_description?.includes("#") ? "#151515" : "transparent",
              padding: currentLesson?.exercise_description?.includes("#") ? "10px" : "0",
              borderRadius: "4px",
              direction: (currentLesson?.exercise_description?.includes("#") || currentLesson?.exercise_description?.includes("=")) ? "ltr" : "rtl",
              textAlign: (currentLesson?.exercise_description?.includes("#") || currentLesson?.exercise_description?.includes("=")) ? "left" : "right"

            }}>
              {currentLesson?.exercise_description ? (
                renderTextWithSmartBreaks(currentLesson.exercise_description)
              ) : (
                <div style={{ color: "#aaa", fontSize: "0.85rem", direction: "rtl", textAlign: "right" }}>
                  אנא בחר או ג'נרט יחידת לימוד בפאנל המנהל.
                </div>
              )}
            </div>
          </div>


          {/* 🛠️ אזור כפתורי רמזי ה-AI המשודרגים */}
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "15px" }}>
            <h5 style={{ margin: "5px 0", color: "#aaa", fontSize: "0.85rem" }}>שלבי עזרה מונחים:</h5>
            
            {!currentLesson.hints || currentLesson.hints.length === 0 ? (
              <div style={{ color: "#666", fontSize: "0.82rem", fontStyle: "italic" }}>💡 אין רמזים זמינים לשיעור זה. ג'נרט רמזים בפאנל מנהל.</div>
            ) : (
              [...currentLesson.hints]
                .sort((a, b) => a.step_number - b.step_number)
                .map((hint, index) => {
                  const isFirst = index === 0;
                  
                  // 🔒 רמז נוכחי יישאר נעול, אלא אם זהו הרמז הראשון, 
                  // או שהרמז המדויק שקודם לו ברשימה הממוינת כבר נמצא במערך ה-unlockedHintIds!
                  const previousHintId = !isFirst ? [...currentLesson.hints].sort((a, b) => a.step_number - b.step_number)[index - 1]?.id : null;
                  const isLocked = !isFirst && !unlockedHintIds.includes(previousHintId);
                  
                  const isActive = activeHintNum === hint.step_number;

                  let buttonBackground = "#3c3c3c";
                  let buttonColor = "#ffffff";
                  let buttonCursor = "pointer";
                  let borderStyle = "1px solid #555";

                  if (isLocked) {
                    buttonBackground = "#2a2a2a";
                    buttonColor = "#666666";
                    buttonCursor = "not-allowed";
                    borderStyle = "1px dashed #444";
                  } else if (isActive) {
                    buttonBackground = "#007acc";
                    borderStyle = "1px solid #0098ff";
                  }

                  return (
                    <div key={hint.id} style={{ display: "flex", flexDirection: "column" }}>
                      <button 
                        disabled={isLocked}
                        // העברת ה-id וה-step_number לפונקציה המעודכנת
                        onClick={() => handleHintClick(hint.id, hint.step_number)} 
                        style={{ 
                          padding: "10px", cursor: buttonCursor, background: buttonBackground, color: buttonColor, border: borderStyle, 
                          textAlign: "right", borderRadius: "6px", fontWeight: isActive ? "bold" : "normal", transition: "all 0.2s ease",
                          display: "flex", justifyContent: "space-between", alignItems: "center"
                        }}
                      >
                        <span>{hint.title}</span>
                        <span style={{ fontSize: "0.9rem" }}>{isLocked ? "🔒" : "💡"}</span>
                      </button>
                      
                      {isActive && (
                        <div style={{ 
                          fontSize: "0.85rem", color: "#dddddd", padding: "12px", background: "#151515", borderRight: "4px solid #007acc", 
                          marginTop: "5px", borderRadius: "4px", boxShadow: "inset 0 0 5px rgba(0,0,0,0.5)"
                        }}>
                          {renderTextWithSmartBreaks(hint.content)}
                          <span 
                            onClick={() => askAIForHelp(hint.title, hint.content)} 
                            style={{ color: "#4fc1ff", cursor: "pointer", textDecoration: "underline", display: "block", marginTop: "8px", fontWeight: "bold" }}
                          >
                            🙋‍♂️ שאל את ה-AI על שלב זה
                          </span>
                        </div>
                      )}
                    </div>
                  );
                })
            )}
          </div>


          {/* 🔑 אזור חשיפת פתרון רשמי מוגן מספוילרים */}
          <div style={{ marginTop: "20px", borderTop: "1px solid #333", paddingTop: "15px" }}>
            {/* כפתור החשיפה נפתח ללחיצה רק אם המשתמש הגיע לרמז האחרון (למשל שלב 3) */}
            <button
              disabled={maxUnlockedStep < (currentLesson.hints?.length || 3)}
              onClick={() => setShowSolution(!showSolution)}
              style={{
                width: "100%",
                padding: "10px",
                background: maxUnlockedStep < (currentLesson.hints?.length || 3) ? "#2a2a2a" : "#e056fd",
                color: maxUnlockedStep < (currentLesson.hints?.length || 3) ? "#666" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: maxUnlockedStep < (currentLesson.hints?.length || 3) ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
                transition: "all 0.2s"
              }}
            >
              {maxUnlockedStep < (currentLesson.hints?.length || 3) 
                ? "🔒 פתרון נעול (השתמש ברמזים תחילה)" 
                : showSolution ? "👁️ הסתר פתרון רשמי" : "✨ הצג פתרון רשמי"}
            </button>

            {showSolution && currentLesson.solution_code && (
              <div style={{ marginTop: "10px", background: "#151515", padding: "12px", borderRadius: "6px", border: "1px solid #e056fd", direction: "ltr", textAlign: "left" }}>
                <div style={{ color: "#e056fd", fontSize: "0.75rem", fontWeight: "bold", marginBottom: "5px", direction: "rtl", textAlign: "right" }}>💡 קוד פתרון מומלץ:</div>
                <pre style={{ margin: 0, fontFamily: "monospace", color: "#56fca2", fontSize: "0.85rem", overflowX: "auto" }}>
                  {currentLesson.solution_code}
                </pre>
              </div>
            )}
          </div>


        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "10px", background: "#252526", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333" }}>
          <div style={{ display: "flex", gap: "10px", alignItems: "center" }}>
            <button onClick={() => setShowSyllabus(!showSyllabus)} style={{ cursor: "pointer", padding: "4px 8px" }}>Syllabus</button>
            <button onClick={() => setShowAgent(!showAgent)} style={{ cursor: "pointer", padding: "4px 8px" }}>AI Agent</button>
            
            {/* ⚙️ פאנל מנהל נשאר בכותרת הכללית */}
            <button onClick={() => setIsAdminView(true)} style={{ cursor: "pointer", padding: "4px 10px", background: "#a142f5", color: "white", border: "none", borderRadius: "4px", fontWeight: "bold" }}>⚙️ פאנל מנהל</button>
          </div>
          <span style={{ color: "#aaa", fontSize: "0.9rem" }}>workspace / main.py</span>
          <button onClick={handleRunCode} disabled={isLoadingCode} style={{ background: "#4caf50", color: "white", padding: "5px 15px", cursor: "pointer", border: "none", fontWeight: "bold", borderRadius: "4px" }}>Run</button>
        </div>

        <div style={{ flex: 7 }}>
          <Editor height="100%" defaultLanguage="python" theme="vs-dark" value={code} onMount={handleEditorDidMount} onChange={(v) => setCode(v || "")} options={{ automaticLayout: true }} />
        </div>
        <div style={{ flex: 3, borderTop: "2px solid #333", background: "#151515", padding: "15px", overflowY: "auto", boxSizing: "border-box" }}>
          <div style={{ fontSize: "0.8rem", color: "#aaa", marginBottom: "5px", textAlign: "left" }}>Terminal Output</div>
          <pre style={{ color: "#4fc1ff", fontSize: "0.9rem", margin: 0, textAlign: "left", direction: "ltr" }}>{output}</pre>
        </div>
      </div>

      {showAgent && (
        <div style={{ flex: "0 0 25%", minWidth: "300px", borderLeft: "1px solid #333", background: "#1e1e1e", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "15px", background: "#252526", borderBottom: "1px solid #333", fontWeight: "bold", textAlign: "right" }}>🤖 AI Assistant</div>
          <div style={{ flex: 1, padding: "15px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "10px" }}>
            {messages.map(m => (
              <div key={m.id} style={{ alignSelf: m.sender === "user" ? "flex-end" : "flex-start", background: m.sender === "user" ? "#007acc" : "#333", padding: "12px", borderRadius: "8px", maxWidth: "85%" }}>
                {renderMessageContent(m.text)}
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div style={{ padding: "15px", display: "flex", gap: "5px", background: "#252526", borderTop: "1px solid #333" }}>
            <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === "Enter" && handleSendMessage()} style={{ flex: 1, padding: "8px", background: "#3c3c3c", color: "#fff", border: "1px solid #555", borderRadius: "4px", direction: "rtl" }} placeholder="שאל את הסוכן..." />
            <button onClick={handleSendMessage} style={{ background: "#007acc", color: "white", padding: "8px 15px", border: "none", cursor: "pointer", borderRadius: "4px", fontWeight: "bold" }}>שלח</button>
          </div>
        </div>
      )}

      {showModal && (
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", justifyContent: "center", alignItems: "center" }}>
          <div style={{ width: "90%", height: "90%", background: "#2d2d2d", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "10px", display: "flex", justifyContent: "flex-end", background: "#252526" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "red", color: "white", padding: "5px 15px", cursor: "pointer", border: "none", borderRadius: "4px", fontWeight: "bold" }}>סגור מצגת</button>
            </div>
            <iframe src={currentLesson.presentation_url} width="100%" height="100%" style={{ border: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}
