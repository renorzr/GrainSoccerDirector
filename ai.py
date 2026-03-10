import base64
from io import BytesIO
import openai
import os

OPENAI_API_KEY = os.getenv("OPENAI_API_KEY")
OPENAI_BASE_URL = os.getenv("OPENAI_BASE_URL", "https://dashscope.aliyuncs.com/compatible-mode/v1")
MODEL = os.getenv("OPENAI_MODEL", "qwen-vl-max-latest")

ai_client = openai.OpenAI(
    api_key=OPENAI_API_KEY,
    base_url=OPENAI_BASE_URL,
)

class ChatAI:
    def __init__(self, model=MODEL):
        self.model = model
        self.messages = []

    def chat(self, prompt):
        print("chat:", prompt)
        self.messages.append({"role": "user", "content": prompt})
        response = ai_client.chat.completions.create(
            model=self.model,
            messages=self.messages,
        )
        self.messages.append({"role": "assistant", "content": response.choices[0].message.content})
        result = response.choices[0].message.content
        print("chat result:", result)
        return result
