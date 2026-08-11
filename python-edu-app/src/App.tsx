import { useState, useEffect, useRef } from "react";
import Editor from "@monaco-editor/react";

interface Message {
  id: number;
  text: string;
  sender: "user" | "agent";
}

const demoLesson = {
  id: 1,
  subject: "שיעור 1: לולאות For בפייתון",
  presentationUrl: "https://google.com",
  exerciseDescription: "כתוב לולאת for שמדפיסה את הריבועים של המספרים מ-1 עד 4 (כלומר: 1, 4, 9, 16).",
  hints: {
    structure: "אנחנו צריכים להשתמש בלולאת for בשילוב עם פונקציית range המובנית.",
    range: "בפייתון הטווח אינו כולל את המספר האחרון! נסה להשתמש ב-range(1, 5).",
    action: "בתוך הלולאה (עם הזחה!), עליך להדפיס את המשתנה כפול עצמו (i * i)."
  }
};
export default function App() {
  const [code, setCode] = useState<string>("# כתוב את קוד הפייתון שלך כאן\n");
  const [output, setOutput] = useState<string>("הפלט יופיע כאן לאחר לחיצה על Run...");
  const [isLoadingCode, setIsLoadingCode] = useState<boolean>(false);
  const [messages, setMessages] = useState<Message[]>([
    { id: 1, text: "שלום עמית! אני סוכן ה-AI שלך. במה אוכל לעזור?", sender: "agent" }
  ]);
  const [input, setInput] = useState("");
  
  const [showAgent, setShowAgent] = useState<boolean>(true);
  const [showSyllabus, setShowSyllabus] = useState<boolean>(true);
  const [showModal, setShowModal] = useState<boolean>(false);
  const [activeHint, setActiveHint] = useState<"none" | "structure" | "range" | "action">("none");

  const chatEndRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<any>(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  function handleEditorDidMount(editor: any) {
    editorRef.current = editor;
  }

  const askAIForHelp = (hintType: string) => {
    setShowAgent(true);
    let textToSend = "";
    if (hintType === "structure") textToSend = "תוכל להסביר לי על המבנה של לולאת for?";
    if (hintType === "range") textToSend = "איך עובד הטווח (range) בלולאה?";
    if (hintType === "action") textToSend = "מה לכתוב בתוך הלולאה בשביל לחשב ריבוע?";
    setInput(textToSend);
  };
  const handleSendMessage = async () => {
    if (!input.trim()) return;
    const userMsg: Message = { id: Date.now(), text: input, sender: "user" };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    const typingId = Date.now() + 1;
    setMessages(prev => [...prev, { id: typingId, text: "...הסוכן חושב", sender: "agent" }]);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/chat`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: input, code })
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
      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/run`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code })
      });
      const data = await res.json();
      setOutput(`>>> Python main.py\n${data.output}`);
    } catch {
      setOutput("❌ ודא ששרת ה-Backend רץ בפורט 5000.");
    } finally { setIsLoadingCode(false); }
  };

  const renderMessageContent = (text: string) => {
    if (!text.includes("```")) {
      return (
        <div dir="auto" style={{ textAlign: "right", lineHeight: "1.5", fontSize: "0.95rem", whiteSpace: "pre-wrap" }}>
          {text}
        </div>
      );
    }
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
      return (
        <div key={index} dir="auto" style={{ textAlign: "right", lineHeight: "1.5", fontSize: "0.95rem", margin: "5px 0", whiteSpace: "pre-wrap" }}>
          {part}
        </div>
      );
    });
  };
  return (
    <div style={{ display: "flex", width: "100vw", height: "100vh", backgroundColor: "#1e1e1e", color: "#fff", margin: 0, overflow: "hidden" }}>
      {showSyllabus && (
        <div style={{ flex: "0 0 20%", minWidth: "250px", borderRight: "1px solid #333", background: "#252526", display: "flex", flexDirection: "column", padding: "15px", direction: "rtl" }}>
          <h3 style={{ color: "#4fc1ff", margin: "0 0 10px 0" }}>📖 סילבוס</h3>
          <button onClick={() => setShowModal(true)} style={{ color: "#4fc1ff", cursor: "pointer", background: "none", border: "none", textAlign: "right", marginBottom: "15px", padding: 0 }}>🖥️ מצגת שיעור</button>
          <div style={{ background: "#1e1e1e", padding: "10px", borderRadius: "6px", marginBottom: "15px" }}>
            <h5 style={{ margin: "0 0 5px 0", color: "#4caf50" }}>תרגיל:</h5>
            <p style={{ margin: 0, fontSize: "0.85rem", lineHeight: "1.4" }}>{demoLesson.exerciseDescription}</p>
          </div>
          <button onClick={() => setActiveHint("structure")} style={{ padding: "8px", marginBottom: "5px", cursor: "pointer" }}>1. מבנה הלולאה</button>
          {activeHint === "structure" && <div style={{ fontSize: "0.8rem", color: "#aaa", padding: "5px", marginBottom: "10px" }}>{demoLesson.hints.structure}<br/><span onClick={() => askAIForHelp("structure")} style={{ color: "#4fc1ff", cursor: "pointer", textDecoration: "underline" }}>שאל את ה-AI</span></div>}
          <button onClick={() => setActiveHint("range")} style={{ padding: "8px", marginBottom: "5px", cursor: "pointer" }}>2. טווח ה-Range</button>
          {activeHint === "range" && <div style={{ fontSize: "0.8rem", color: "#aaa", padding: "5px", marginBottom: "10px" }}>{demoLesson.hints.range}<br/><span onClick={() => askAIForHelp("range")} style={{ color: "#4fc1ff", cursor: "pointer", textDecoration: "underline" }}>שאל את ה-AI</span></div>}
        </div>
      )}

      <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0 }}>
        <div style={{ padding: "10px", background: "#252526", display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #333" }}>
          <div style={{ display: "flex", gap: "10px" }}>
            <button onClick={() => setShowSyllabus(!showSyllabus)} style={{ cursor: "pointer", padding: "4px 8px" }}>Syllabus</button>
            <button onClick={() => setShowAgent(!showAgent)} style={{ cursor: "pointer", padding: "4px 8px" }}>AI Agent</button>
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
        <div style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.85)", zIndex: 100, display: "flex", justifyContent: "center", center: "center" }}>
          <div style={{ width: "90%", height: "90%", background: "#2d2d2d", display: "flex", flexDirection: "column", borderRadius: "8px", overflow: "hidden" }}>
            <div style={{ padding: "10px", display: "flex", justifyContent: "flex-end", background: "#252526" }}>
              <button onClick={() => setShowModal(false)} style={{ background: "red", color: "white", padding: "5px 15px", cursor: "pointer", border: "none", borderRadius: "4px", fontWeight: "bold" }}>סגור מצגת</button>
            </div>
            <iframe src={demoLesson.presentationUrl} width="100%" height="100%" style={{ border: "none" }} />
          </div>
        </div>
      )}
    </div>
  );
}
