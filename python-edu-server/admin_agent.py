import sys
import io
import json
from openai import OpenAI
from dotenv import load_dotenv

# פתרון בעיית קידוד עברית בטרמינל עבור מערכות הפעלה שונות
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()
client = OpenAI()

# 1. קריאת הנתונים שהגיעו משרת ה-Node.js
if len(sys.argv) < 2:
    print(json.dumps({"error": "No arguments provided"}))
    sys.exit(1)

try:
    raw_payload = sys.argv[1]
    payload = json.loads(raw_payload)
    subject = payload.get("subject", "")
except Exception as e:
    print(json.dumps({"error": f"Failed to parse backend payload: {str(e)}"}))
    sys.exit(1)

# 2. הגדרת סכמת ה-JSON המדויקת כאובייקט עליון מובהק ({})
json_schema = {
    "type": "object",
    "properties": {
        "topic_material": {
            "type": "string",
            "description": "הסבר תיאורטי קצר, ברור וממוקד בעברית על נושא השיעור כולל דוגמה קטנה."
        },
        "exercise_description": {
            "type": "string",
            "description": "תיאור מפורט של תרגיל ומשימת הפייתון המבוקשת עבור הסטודנט בעברית."
        },
        "solution_code": {
            "type": "string",
            "description": "קוד הפתרון הרשמי והתקין בשפת פייתון שיפתור את התרגיל."
        },
        "hints": {
            "type": "array",
            "description": "מערך של 3 רמזים פדגוגיים הדרגתיים שיעזרו לסטודנט לפתור את המשימה.",
            "items": {
                "type": "object",
                "properties": {
                    "step_number": { "type": "integer", "description": "מספר השלב של הרמז (1, 2 או 3)." },
                    "title": { "type": "string", "description": "כותרת קצרה ומזמינה לרמז." },
                    "content": { "type": "string", "description": "תוכן הרמז המנחה בעברית, ללא חשיפת פתרון ישיר." }
                },
                "required": ["step_number", "title", "content"],
                "additionalProperties": False
            }
        }
    },
    "required": ["topic_material", "exercise_description", "solution_code", "hints"],
    "additionalProperties": False
}

# 3. בניית הנחיות המערכת הפדגוגיות עבור סוכן המרצים
system_instruction = (
    "You are an expert Python curriculum developer for middle school students.\n"
    "Your goal is to create a structured lesson with a ABSOLUTE separation of content types.\n\n"
    "FEW-SHOT EXAMPLES OF CORRECT SEPARATION:\n"
    "Example 1 (Topic: Variables):\n"
    "- topic_material: 'משתנה הוא כמו קופסה בזיכרון המחשב שבה אנחנו שומרים מידע. אנחנו נותנים לקופסה שם כדי שנוכל למצוא אותה אחר כך...'\n"
    "- exercise_description: 'צור משתנה חדש בשם age ושמור בו את הגיל שלך. לאחר מכן הדפס את התוצאה למסך.'\n\n"
    "Example 2 (Topic: Math):\n"
    "- topic_material: 'בפייתון ניתן לבצע פעולות חשבון כמו חיבור (+), חיסור (-), כפל (*) וחילוק (/). התוצאה נשמרת לעיתים קרובות במשתנה חדש...'\n"
    "- exercise_description: 'הגדר משתנה בשם num1 עם הערך 10 ומשתנה בשם num2 עם הערך 5. חשב את הסכום שלהם והצג אותו.'\n\n"
    "STRICT OUTPUT RULES:\n"
    "1. 'topic_material': Write ONLY general theory/concepts in Hebrew. NO instructions like 'create a variable' or 'do this'.\n"
    "2. 'exercise_description': Write ONLY verbal instructions in Hebrew describing WHAT the student should do.\n"
    "   - FORBIDDEN: NEVER use code, '=', or 'print()' here.\n"
    "3. 'solution_code': Provide ONLY the actual Python script.\n"
    "4. All text must be in fluent Hebrew."
)


# user_prompt = f"Please generate a comprehensive lesson structure for the following Python topic: '{subject}'"
user_prompt = f"""
Generate a lesson for the topic: '{subject}'.
Make sure the 3 hints are directly derived from the 'topic_material' you explained.
The hints should guide the student to use the specific syntax mentioned in the theory.
"""


try:
    # 4. פנייה ל-OpenAI עם אכיפת פורמט ה-JSON המדויק
    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[
            {"role": "system", "content": system_instruction},
            {"role": "user", "content": user_prompt}
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": "python_lesson_generator",
                "strict": True,
                "schema": json_schema
            }
        },
        temperature=0.8
    )

    # 5. הדפסת הפלט הטהור - שרת ה-Node.js יקרא את זה בהצלחה
    print(response.choices[0].message.content)

except Exception as e:
    print(json.dumps({"error": f"AI generation failed: {str(e)}"}))
    sys.exit(1)
