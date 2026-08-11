import sys
import io
import json
import os
from subprocess import run, PIPE
from openai import OpenAI
from dotenv import load_dotenv

# 🔥 הוסף את השורה הזו כדי לפתור את בעיית העברית ב-Windows
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()
client = OpenAI()

# ==========================================
# 🔧 הגדרת הכלים (Tools) שהסוכן יכול להפעיל
# ==========================================

def execute_student_code(code_to_run: str) -> str:
    """מריץ קוד פייתון בצורה מאובטחת ומחזיר את פלט הטרמינל (stdout/stderr)."""
    try:
        # הרצת הקוד בתוך תהליך מבודד זמני עם הגבלת זמן של 3 שניות
        result = run(
            [sys.executable, "-c", code_to_run],
            stdout=PIPE,
            stderr=PIPE,
            text=True,
            timeout=3
        )
        
        output = result.stdout if result.stdout else ""
        errors = result.stderr if result.stderr else ""
        
        if errors:
            return f"[שגיאת הרצה מהטרמינל]:\n{errors}"
        return f"[פלט הרצה מוצלח]:\n{output}"
        
    except Exception as e:
        return f"[שגיאה במערכת ההרצה]: {str(e)}"

# מיפוי מחרוזת השם לפונקציה האמיתית
tools_map = {
    "execute_student_code": execute_student_code
}

# הגדרת הסכמה (Schema) ש-OpenAI דורשת כדי להבין מתי להשתמש בכלי
tools_schema = [
    {
        "type": "function",
        "function": {
            "name": "execute_student_code",
            "description": "השתמש בכלי זה כדי להריץ את קוד הפייתון שהסטודנט כתב, כדי לראות את פלט הטרמינל או לבדוק שגיאות ריצה (Runtime Errors) אמיתיות.",
            "parameters": {
                "type": "object",
                "properties": {
                    "code_to_run": {
                        "type": "string",
                        "description": "קוד הפייתון המלא של הסטודנט שברצונך להריץ ולבדוק."
                    }
                },
                "required": ["code_to_run"]
            }
        }
    }
]

# ==========================================
# 🤖 לולאת הסוכן המרכזית (Control Loop)
# ==========================================

def run_agent(user_message: str, student_code: str):
    system_instruction = (
        "You are an expert Python programming tutor. Your job is to help students learn.\n"
        "You have access to a tool called 'execute_student_code'.\n"
        "Do NOT give them the direct code solution immediately. Give them hints and guide them.\n"
        "Always respond politely in Hebrew.\n"
        "1. Every single line of code, function name (like `range()`), or lists of numbers MUST be in backticks (e.g. `0, 1, 2, 3, 4`).\n"
        "2. Explain your points using standard bullet lists (1. , 2. , 3.). Do not add escape characters manually."
    )


    
    full_prompt = f"Student Question: {user_message}\n\nCurrent Student Code:\n```python\n{student_code}\n```"

    messages = [
        {"role": "system", "content": system_instruction},
        {"role": "user", "content": full_prompt}
    ]
    
    # תחילת לולאת ה-Reasoning & Acting
    while True:
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=messages,
            tools=tools_schema,
            tool_choice="auto",
            temperature=0.7
        )
        
        response_message = response.choices[0].message
        messages.append(response_message) # שמירת שלבי החשיבה של המודל בהיסטוריה
        
        # תרחיש א': המודל החליט שהוא צריך להפעיל את הכלי (להריץ את הקוד)
        if response_message.tool_calls:
            for tool_call in response_message.tool_calls:
                function_name = tool_call.function.name
                function_args = json.loads(tool_call.function.arguments)
                
                # הרצת הכלי המקומי
                run_function = tools_map[function_name]
                tool_output = run_function(**function_args)
                
                # החזרת תוצאת הטרמינל אל תוך ההיסטוריה של המודל
                messages.append({
                    "tool_call_id": tool_call.id,
                    "role": "tool",
                    "name": function_name,
                    "content": tool_output,
                })
            # ממשיכים את הלולאה כדי שהמודל יעבד את תוצאות ההרצה ויחליט מה לענות
            continue 
            
        # תרחיש ב': המודל סיים לחשוב ולהריץ, ויש לו תשובה סופית לסטודנט
        else:
            return response_message.content

if __name__ == "__main__":
    if len(sys.argv) > 1:
        try:
            raw_input = sys.argv[1]
            data = json.loads(raw_input)
            
            user_msg = data.get("message", "")
            code_ctx = data.get("code", "")
            
            reply = run_agent(user_msg, code_ctx)
            print(reply)
            
        except Exception as e:
            print(f"Error in python agent execution: {str(e)}")
    else:
        print("No arguments provided.")
