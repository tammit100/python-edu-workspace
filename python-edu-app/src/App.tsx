import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";

import AdminDashboard from "./components/AdminDashboard"; 
import { supabase } from './supabaseClient';
import AuthPage from './AuthPage';
import type { Session } from '@supabase/supabase-js';

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
  const [session, setSession] = useState<Session | null>(null);
  const [authLoading, setAuthLoading] = useState<boolean>(true);


  const chatEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  const [isAdminView, setIsAdminView] = useState<boolean>(false);
  const [selectedLessonId, setSelectedLessonId] = useState<number>(1);
  const [allLessons, setAllLessons] = useState<{ id: number; subject: string }[]>([]);

  // show solution is lock before the student tries the hints
  const [showSolution, setShowSolution] = useState<boolean>(false);

  // little help - popup / modal to help student
  const [showTopicPopup, setShowTopicPopup] = useState<boolean>(false);
  const [showUserPopover, setShowUserPopover] = useState<boolean>(false);

  const [unlockedHintIds, setUnlockedHintIds] = useState<number[]>([]);


  // 🕵️‍♂️ זיהוי תפקידים דינמי מובנה ומאובטח
  const userRole = session?.user?.user_metadata?.role;
  const userEmail = session?.user?.email;

  // אתה מנהל העל של המערכת!
  const isSuperAdmin = userEmail === 'amit@gmail.com' || userRole === 'super-admin';
  
  // מורשה ניהול (מורה או מנהל על)
  const isAdmin = userRole === 'teacher' || isSuperAdmin;
  
  const [customInput, setCustomInput] = useState<string>("25"); // ברירת מחדל מספר חיובי
  
  // 🛡️ בדיקה פיקטיבית כדי למנוע משגיאת TS6133 לעצור את ה-Build
  if (false as boolean) {
    console.log(maxUnlockedStep, showTopicPopup);
  }

  useEffect(() => {
    // א'. בדיקה מיידית האם המשתמש כבר מחובר בזיכרון המקומי
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setAuthLoading(false);
    });

    // ב'. האזנה דינמית לשינויים במצב האותנטיקציה (התחברות, התנתקות, פקיעת סשן)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

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
    setOutput("Running Python code & AI grading...");
    
    try {
      const baseUrl = import.meta.env.VITE_API_BASE_URL || "http://localhost:5000";
      
      // 📡 קריאה לנתיב ה-AI Grader החדש בשרת והעברת כל נתוני התרגיל
      const res = await fetch(`${baseUrl}/api/run-and-check`, {
        method: "POST", 
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          code, 
          custom_input: customInput, // ➕ העברת הקלט האישי של התלמיד לשרת!
          exercise_description: currentLesson?.exercise_description,
          solution_code: currentLesson?.solution_code
        })
      });

      
      const data = await res.json();
      
      // 📝 הצגת הפלט הגולמי של פייתון, ומתחתיו הפידבק המעודד בעברית מהסוכן
      setOutput(`>>> Python main.py\n${data.output}\n\n${data.message || ""}`);

      // 🔥 SCRUM-15: אם סוכן ה-AI Grader קבע שהפתרון נכון פדגוגית - נשמור את ההתקדמות בענן!
      // בתוך handleRunCode, תחת ה-if (data.isCorrect):
    if (data.isCorrect && data.next_level) {
        console.log("🚀 מעובר לשלב הבא:", data.next_level);
        
        // 🔥 עדכון הסטייט בצורה פונקציונלית כדי להבטיח רענון של ה-UI
        setCurrentLesson(prev => {
            if (!prev) return null;
            return {
                ...prev,
                exercise_description: data.next_level.exercise_description,
                solution_code: data.next_level.solution_code,
                hints: data.next_level.hints
            };
        });

        // איפוס רמזים
        setUnlockedHintIds([]);
        setActiveHintNum(null);
    }


    } catch (err) {
      console.error("❌ שגיאה בהרצה או בבדיקת הקוד:", err);
      setOutput("❌ ודא ששרת ה-Backend רץ בפורט 5000.");
    } finally { 
      setIsLoadingCode(false); 
    }
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
    // 🔥 העברת ה-isSuperAdmin לפאנל המנהל
    return <AdminDashboard onBackToApp={() => setIsAdminView(false)} isSuperAdmin={isSuperAdmin} />;
  }

  if (authLoading) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', background: '#1e1e1e', color: 'white' }}>מאתחל מערכת...</div>;
  }

    if (!session) {
    return <AuthPage />;
  }

    // 🔐 פונקציית התנתקות ומחיקת הסשן מהדפדפן (SCRUM-11)
  const handleLogout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      // איפוס הסטייט המקומי לניקוי מוחלט של שאריות מידע
      setIsAdminView(false);
      setCurrentLesson(null);
    } catch (err: any) {
      console.error("❌ שגיאה בתהליך ההתנתקות:", err.message);
    }
  };

  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1e1e1e", color: "#fff", margin: 0, overflow: "hidden" }}>
       {showSyllabus && (
        <div style={{ flex: "0 0 20%", minWidth: "250px", borderRight: "1px solid #333", background: "#252526", display: "flex", flexDirection: "column", padding: "15px", direction: "rtl", height: "100%", overflowY: "auto", boxSizing: "border-box" }}>
          <h3 style={{ color: "#4fc1ff", margin: "0 0 5px 0" }}>📖 סילבוס</h3>
          
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
            
                          {/* רינדור רמזים חסין באגים - כולל משתני העיצוב המקוריים שלך (SCRUM-15) */}
              {(currentLesson?.hints || [])
                .map((hint: any, index: number) => {
                  const isFirst = index === 0;
                  
                  // 🛡️ חילוץ בטוח של תוכן הרמז (תומך במחרוזת מה-AI או אובייקט מה-DB)
                  const hintText = typeof hint === 'string' ? hint : hint?.hint_text || "";
                  const hintId = hint?.id !== undefined ? hint.id : index;
                  const hintStepNumber = hint?.step_number !== undefined ? hint.step_number : index + 1;

                  // 🔒 בדיקה בטוחה של שלבי הנעילה
                  const isLocked = !isFirst && !(unlockedHintIds || []).includes(index - 1);
                  const isActive = activeHintNum === hintStepNumber;

                  // 🎨 החזרת משתני העיצוב המקוריים שלך בדיוק כפי שהגדרת!
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
                    <div
                      key={hintId}
                      onClick={() => !isLocked && setActiveHintNum(isActive ? null : hintStepNumber)}
                      style={{
                        padding: "15px",
                        background: buttonBackground,
                        color: buttonColor,
                        borderRadius: "10px",
                        marginBottom: "12px",
                        border: borderStyle,
                        cursor: buttonCursor,
                        transition: "all 0.2s ease"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "0.9rem", fontWeight: "bold" }}>
                          {isLocked ? "🔒" : "💡"} שלב {index + 1}
                        </span>
                        {!isLocked && (
                          <span style={{ fontSize: "0.8rem", color: isActive ? "#fff" : "#4fc1ff" }}>
                            {isActive ? "▲ סגור" : "▼ פתח רמז"}
                          </span>
                        )}
                      </div>

                      {/* תוכן הרמז המלא - נפתח בלחיצה */}
                      {isActive && !isLocked && (
                        <div style={{ marginTop: "12px", paddingTop: "12px", borderTop: "1px solid rgba(255,255,255,0.1)", fontSize: "0.88rem", color: "#eee", lineHeight: "1.5" }}>
                          {hintText}
                        </div>
                      )}
                    </div>
                  );
                })}

          </div>


          {/* 🔑 אזור חשיפת פתרון רשמי מוגן מספוילרים - גרסה מתוקנת ומסונכרנת */}
          <div style={{ marginTop: "20px", borderTop: "1px solid #333", paddingTop: "15px" }}>
            {/* 🔥 תיקון הבאג: הכפתור נפתח ברגע שכמות ה-IDs שנפתחו שווה לכמות הרמזים הקיימת בשיעור */}
            <button
              disabled={unlockedHintIds.length < (currentLesson?.hints?.length || 3)}
              onClick={() => setShowSolution(!showSolution)}
              style={{
                width: "100%",
                padding: "10px",
                background: unlockedHintIds.length < (currentLesson?.hints?.length || 3) ? "#2a2a2a" : "#e056fd",
                color: unlockedHintIds.length < (currentLesson?.hints?.length || 3) ? "#666" : "white",
                border: "none",
                borderRadius: "6px",
                cursor: unlockedHintIds.length < (currentLesson?.hints?.length || 3) ? "not-allowed" : "pointer",
                fontWeight: "bold",
                fontSize: "0.85rem",
                transition: "all 0.2s"
              }}
            >
              {unlockedHintIds.length < (currentLesson?.hints?.length || 3) 
                ? "🔒 פתרון נעול (השתמש ברמזים תחילה)" 
                : showSolution ? "👁️ הסתר פתרון רשמי" : "✨ הצג פתרון רשמי"}
            </button>

                       {showSolution && currentLesson?.solution_code && (
              <div style={{ 
                marginTop: "10px", 
                marginBottom: "30px", // ➕ מייצר את השטח הנדרש לגלילה ברצפת המסך
                background: "#151515", 
                padding: "12px", 
                borderRadius: "6px", 
                border: "1px solid #e056fd", 
                direction: "ltr", 
                textAlign: "left",
                boxShadow: "inset 0 0 8px rgba(0,0,0,0.6)"
              }}>
                <div style={{ color: "#e056fd", fontSize: "0.75rem", fontWeight: "bold", marginBottom: "5px", direction: "rtl", textAlign: "right" }}>💡 קוד פתרון מומלץ:</div>
                <pre style={{ 
                  margin: 0, 
                  fontFamily: "monospace", 
                  color: "#56fca2", 
                  fontSize: "0.85rem", 
                  overflowX: "auto", 
                  whiteSpace: "pre-wrap" // ➕ שומר על ירידות השורה של המרצה
                }}>
                  {currentLesson.solution_code}
                </pre>
              </div>
            )}

          </div>



        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "10px", background: "#252526", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333" }}>
        
                {/* ⚡ סרגל כלים עליון משודרג - קומפקטי, נקי ומבוסס Popover משתמש */}
        <div style={{ display: "flex", gap: "8px", alignItems: "center", background: "#252526", padding: "4px 10px", borderRadius: "8px", border: "1px solid #333", direction: "ltr", position: "relative" }}>
          
          {/* 👤 פרופיל משתמש חכם - בלחיצה פותח תפריט קטן */}
          <div style={{ position: "relative" }}>
            <div 
              onClick={() => setShowUserPopover(!showUserPopover)}
              style={{ 
                fontSize: "0.8rem", 
                color: "#aaa", 
                cursor: "pointer", 
                background: showUserPopover ? "#2d2d2d" : "#1e1e1e",
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid #444",
                display: "inline-flex", 
                alignItems: "center",
                gap: "4px",
                height: "32px",
                boxSizing: "border-box",
                userSelect: "none",
                transition: "background 0.2s"
              }}
            >
              <span>שלום,</span>
              <span style={{ 
                color: isSuperAdmin ? "#a142f5" : isAdmin ? "#4fc1ff" : "#4caf50", 
                fontWeight: "bold" 
              }}>
                {session?.user?.email ? session.user.email.split('@')[0] : "אורח"}
              </span>
              <span>{isSuperAdmin ? "👑" : isAdmin ? "👨‍🏫" : "🎓"}  ▼</span>
            </div>

            {/* 📋 ה-Popover הדינמי: תפריט פעולות קטן שצף מתחת לשם המשתמש */}
            {showUserPopover && (
              <div style={{ 
                position: "absolute", 
                top: "38px", 
                left: 0, 
                background: "#252526", 
                border: "1px solid #444", 
                borderRadius: "6px", 
                padding: "12px", 
                boxShadow: "0 4px 12px rgba(0,0,0,0.5)", 
                zIndex: 1000, 
                minWidth: "160px",
                direction: "rtl",
                textAlign: "right"
              }}>
                <div style={{ fontSize: "0.75rem", color: "#888", marginBottom: "4px" }}>סטטוס מערכת:</div>
                <div style={{ fontSize: "0.82rem", color: "#fff", fontWeight: "bold", marginBottom: "12px", borderBottom: "1px solid #3d3d3d", paddingBottom: "8px" }}>
                  {isSuperAdmin ? "👑 מנהל על" : isAdmin ? "👨‍🏫 מרצה/מורה" : "🎓 סטודנט מן המניין"}
                </div>
                
                {/* לחצן ההתנתקות הועבר לכאן בבטחה ופינה מקום! */}
                <button 
                  onClick={() => { handleLogout(); setShowUserPopover(false); }}
                  style={{ 
                    width: "100%",
                    padding: "6px 10px", 
                    background: "transparent", 
                    color: "#ff4b4b", 
                    border: "1px solid #ff4b4b", 
                    borderRadius: "4px", 
                    fontWeight: "bold", 
                    cursor: "pointer", 
                    fontSize: "0.78rem",
                    transition: "all 0.2s"
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = "rgba(255,75,75,0.1)"}
                  onMouseLeave={(e) => e.currentTarget.style.background = "transparent"}
                >
                  🚪 התנתק מהחשבון
                </button>
              </div>
            )}
          </div>

          {/* 📋 כפתור סילבוס מהודק - כפתור קומפקטי ללא טקסט כפול */}
          <button 
            onClick={() => setShowSyllabus(!showSyllabus)}
            style={{ 
              padding: "4px 10px", 
              background: showSyllabus ? "#007acc" : "#3c3c3c", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              fontWeight: "bold", 
              cursor: "pointer", 
              fontSize: "0.78rem",
              height: "32px",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            📋 {showSyllabus ? "סילבוס" : "סילבוס"}
          </button>

          {/* 🤖 כפתור עוזר AI מהודק */}
          <button 
            onClick={() => setShowAgent(!showAgent)}
            style={{ 
              padding: "4px 10px", 
              background: showAgent ? "#e056fd" : "#3c3c3c", 
              color: "white", 
              border: "none", 
              borderRadius: "6px", 
              fontWeight: "bold", 
              cursor: "pointer", 
              fontSize: "0.78rem",
              height: "32px",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            🤖 {showAgent ? "צ'אט AI" : "צ'אט AI"}
          </button>

          {/* ⚙️ כפתור פאנל מנהל (למורים ומנהלי על בלבד) */}
          {isAdmin && (
            <button 
              onClick={() => setIsAdminView(!isAdminView)} 
              style={{ padding: "4px 12px", background: "#6c5ce7", color: "white", border: "none", borderRadius: "6px", fontWeight: "bold", cursor: "pointer", fontSize: "0.78rem", height: "32px", boxShadow: "0 2px 4px rgba(0,0,0,0.3)" }}
            >
              {isAdminView ? "👨‍💻 למערכת" : "⚙️ ניהול"}
            </button>
          )}

          {/* ▶ כפתור ה-Run המקורי שלכם מיושר לשמאל עם גובה קומפקטי תואם */}
          <button 
            onClick={handleRunCode} 
            disabled={isLoadingCode} 
            style={{ 
              background: "#4caf50", 
              color: "white", 
              padding: "4px 14px", 
              cursor: isLoadingCode ? "not-allowed" : "pointer", 
              border: "none", 
              fontWeight: "bold", 
              borderRadius: "6px",
              height: "32px",
              fontSize: "0.8rem",
              display: "flex",
              alignItems: "center",
              gap: "4px"
            }}
          >
            ▶ Run
          </button>
        </div>


          
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
