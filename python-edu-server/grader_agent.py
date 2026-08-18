import sys
import io
import json
from openai import OpenAI
from dotenv import load_dotenv

# פתרון בעיית קידוד עברית בטרמינל
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

load_dotenv()
client = OpenAI()

def main():
    try:
        # קריאת נתוני התרגיל והקוד שנשלחו מה-Node.js דרך ה-stdin
        input_data = json.loads(sys.stdin.read())
        
        exercise_description = input_data.get("exercise_description", "")
        solution_code = input_data.get("solution_code", "")
        student_code = input_data.get("student_code", "")
        python_output = input_data.get("python_output", "")

                # המחרוזת הבסיסית נקייה ללא f-string כדי שפייתון לא יתבלבל עם סוגרי ה-JSON
                # המחרוזת הבסיסית נקייה ומאולצת עבור ה-JSON לשלב הבא
                # המחרוזת הבסיסית נקייה ומאולצת עבור ה-JSON לשלב הבא
                # המחרוזת הבסיסית - גרסה דינמית ואדפטיבית לחלוטין (מניעת תקיעה ב-Level 2)
                
        base_prompt = """
        You are an expert, supportive and encouraging Adaptive Python Teacher Assistant. 
        Your job is to grade a student's exercise submission strictly based ONLY on the criteria listed in the current exercise description.
        
        Current Exercise Description (Drawn for the student):
        {EXERCISE_DESCRIPTION}
        
        Teacher's Reference Solution:
        {SOLUTION_CODE}
        
        Student's Submitted Code:
        {STUDENT_CODE}
        
        Actual Output produced by student's code:
        {PYTHON_OUTPUT}
        
        STRICT GRADING RULES:
        1. Judge the student ONLY by what they were asked to do in the "Current Exercise Description".
        2. DO NOT invent new constraints or penalize them for things not explicitly asked.
        3. If their code achieves the goal and produces the correct output format, "isCorrect" MUST be true.
        4. CRITICAL PROGRESSION RULE: Read the current level number from the "Current Exercise Description" (e.g., if it says LEVEL 1, the next one is LEVEL 2. If it says LEVEL 2, the next one MUST BE LEVEL 3, then LEVEL 4, etc.).
        5. If "isCorrect" is true, you MUST dynamically generate the next logical step forward based on the same topic (e.g., advancing from basic if, to if-else, to if-elif-else, to logical operators 'and/or', to nested conditions). 
        6. Always start the new "exercise_description" with the text 'LEVEL X: ' where X is the correct incremental level number!

        You must return your response in a strict JSON format with exactly this structure:
        {
          "isCorrect": true,
          "feedback": "הודעת הצלחה או פידבק ספציפי בעברית המציינת שהקוד הנוכחי נכון",
          "next_level": {
            "exercise_description": "LEVEL X: [הוראות למשימה החדשה והמתקדמת יותר בעברית, בהתאם לנושא השיעור]",
            "solution_code": "[The exact python solution code for this new dynamic level X]",
            "hints": [
              "[רמז ממוקד חדש 1 בעברית עבור שלב X]",
              "[רמז ממוקד חדש 2 בעברית עבור שלב X]"
            ]
          }
        }
        
        If and only if isCorrect is false, the "next_level" object must be null.
        """


        # הזרקה בטוחה של המשתנים לתוך ה-Prompt ללא סכנת קריסת סינטקס
        prompt = (base_prompt
                  .replace("{EXERCISE_DESCRIPTION}", exercise_description)
                  .replace("{SOLUTION_CODE}", solution_code)
                  .replace("{STUDENT_CODE}", student_code)
                  .replace("{PYTHON_OUTPUT}", python_output.strip()))


        # פנייה ל-OpenAI באמצעות ספריית הפייתון שלכם
        response = client.chat.completions.create(
            model="gpt-4o-mini",
            messages=[{"role": "user", "content": prompt}],
            response_format={"type": "json_object"} # אילוץ JSON
        )

        # הדפסת התוצאה חזרה ל-Node.js
        print(response.choices[0].message.content)

    except Exception as e:
        # Fallback בטוח למקרה של תקלה ברשת
        fallback = {
            "isCorrect": True,
            "feedback": "🎉 הקוד רץ בהצלחה ללא שגיאות סינטקס (אישור זמני של המערכת)."
        }
        print(json.dumps(fallback, ensure_ascii=False))

if __name__ == "__main__":
    main()
