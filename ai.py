import base64
from io import BytesIO
import openai
import os

DASHSCOPE_API_KEY = os.getenv("DASHSCOPE_API_KEY")
DEFAULT_MODEL = "qwen-vl-max-latest" if DASHSCOPE_API_KEY else "gpt-4o-mini"
MODEL = os.getenv("AI_MODEL", DEFAULT_MODEL)

ai_client = openai.OpenAI(
    api_key=DASHSCOPE_API_KEY,
    base_url="https://dashscope.aliyuncs.com/compatible-mode/v1",
) if DASHSCOPE_API_KEY else openai.OpenAI()

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