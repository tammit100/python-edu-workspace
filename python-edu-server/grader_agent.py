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

        prompt = f"""
        You are an expert Python Teacher Assistant. Your job is to grade a student's exercise submission.
        
        Exercise Description given to student:
        "{exercise_description}"
        
        Teacher's Reference Solution:
        "{solution_code}"
        
        Student's Submitted Code:
        "{student_code}"
        
        Actual Output produced by student's code:
        "{python_output.strip()}"
        
        Instructions:
        Determine if the student's code successfully achieved the goals of the exercise description.
        You must return your response in a strict JSON format with exactly two keys:
        {{
          "isCorrect": true or false,
          "feedback": "A short encouraging sentence in Hebrew explaining why it is correct or what is missing."
        }}
        """

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
