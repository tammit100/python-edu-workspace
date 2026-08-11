# test_key.py
import os
from openai import OpenAI
from dotenv import load_dotenv

load_dotenv()
client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))

try:
    res = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=[{"role": ""content": "Reply with just the word: connected"}]
    )
    print(res.choices.message.content)
except Exception as e:
    print(f"Error: {e}")
