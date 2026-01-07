import subprocess
import time
import os
import hashlib
import requests
import json
from clips import get_duration
VOICE_DIR = 'voices'
base_url = os.getenv('FISH_AUDIO_BASE_URL', 'https://api.fish.audio')
api_key = os.getenv('FISH_AUDIO_API_KEY')

class Voicer:
    def __init__(self, directory, comments):
        self.directory = directory
        self.comments = comments

    def make_voice(self, task=None):
        for index, comment in enumerate(self.comments):
            if task:
                if task.is_cancelled():
                    raise InterruptedError("Voice making was cancelled")
                task.update_progress("make_voice", index, len(self.comments))
            self.make_text_voice(comment.text)

    def make_text_voice(self, text):
        if not text:
            return

        # skip if voice already exists
        voice_path = self.get_voice(text)["path"]
        print(f"make voice for {text} at {voice_path}")
        if os.path.exists(voice_path) and os.path.getsize(voice_path) > 0:
            print(f"voice already exists for {text} at {voice_path}")
            return voice_path

        # generate and save voice
        print(f"generating voice for comment {text} with path {voice_path}")
        os.makedirs(os.path.dirname(voice_path), exist_ok=True)
        
        # Make HTTP API call to Fish Audio TTS
        headers = {
            'Authorization': f'Bearer {api_key}',
            'Content-Type': 'application/json'
        }
        
        payload = {
            "text": text,
            "temperature": 0.7,
            "top_p": 0.7,
            "reference_id": os.getenv('FISH_AUDIO_MODEL'),
            "prosody": {
                "speed": 1,
                "volume": 0
            },
            "chunk_length": 200,
            "normalize": True,
            "format": "mp3",
            "sample_rate": 44100,
            "mp3_bitrate": 128,
            "opus_bitrate": 32,
            "latency": "normal"
        }
        
        try:
            response = requests.post(
                f"{base_url}/v1/tts",
                headers=headers,
                json=payload,
                stream=True
            )
            response.raise_for_status()
            
            with open(voice_path, 'wb') as f:
                for chunk in response.iter_content(chunk_size=8192):
                    if chunk:
                        f.write(chunk)
        except requests.exceptions.RequestException as e:
            print(f"Error generating voice for {text}: {e}")
            return None
        time.sleep(1)

        return voice_path

    def get_voice(self, text):
        voice_path = os.path.join(self.directory, VOICE_DIR, self.voice_name(text))
        if not os.path.exists(voice_path):
            print(f"Voice file not found for {text} at {voice_path}")
            return {"path": voice_path, "duration": 0, "start": 0}

        # Use ffmpeg to get the duration of the audio file
        try:
            duration = get_duration(voice_path)
        except Exception as e:
            print(f"Error getting duration of {voice_path}: {e}")
            return {"path": voice_path, "duration": 0, "start": 0}

        return {"path": voice_path, "duration": duration, "start": 0}

    def voice_name(self, text):
        return f"{hashlib.md5(text.encode('utf-8')).hexdigest()}.mp3" if text else None

