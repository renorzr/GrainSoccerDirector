import dotenv
dotenv.load_dotenv()

import traceback
from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from game import Game
from event import Event
import uvicorn
import os
import yaml
import pickle
from event_analyzer import EventAnalyzer
from editor import Editor
import asyncio
import threading
from datetime import datetime, timedelta
import uuid
from voicer import Voicer
from task import Task, TaskStatus

GAME_DATA_DIR = os.getenv("GAME_DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "games"))
STORAGE_FOLDER = os.getenv("STORAGE_FOLDER", "games/")
VIDEO_REGEX = os.getenv("VIDEO_REGEX", r"\/(\.+\).mp4$")
VIDEO_EXTENSIONS = os.getenv("VIDEO_EXTENSIONS", "mp4,mov,avi,mkv").split(",")


app = FastAPI(
    title="Soccer Director HTTP API",
    description="Soccer Director's simple HTTP API",
    version="0.1.0"
)

# 允许跨域
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 静态文件服务
app.mount("/static", StaticFiles(directory="frontend"), name="static")

# Global task management
current_task: Task = None
task_lock = threading.Lock()


def load_game_metadata(game_id: str):
    game_data = yaml.safe_load(open(os.path.join(GAME_DATA_DIR, 'game.' + game_id + '.yaml'), "r", encoding="utf-8"))
    
    if not game_data.get('logo_video'):
        game_data['logo_video'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'logo.mp4')

    if not game_data.get('scoreboard'):
        game_data['scoreboard'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'scoreboard.yaml')

    return game_data

def make_video_task(game_id: str, segment: int):
    """Background task to make video"""
    global current_task
    try:
        current_task.start()
        
        # Load game data
        game = Game(game_id, load_game_metadata(game_id), GAME_DATA_DIR)
        
        current_task.update_progress("analyzing", 0, 1)
        # Analyze events
        analyzer = EventAnalyzer(game, segment)
        analyzer.analyze()
        
        current_task.update_progress("analyzing", 1, 1)
        
        # Edit video
        editor = Editor(game, segment, current_task)
        editor.edit()
        
        # Mark as completed
        current_task.complete()
                
    except InterruptedError as e:
        # Handle cancellation
        with task_lock:
            current_task.status = TaskStatus.CANCELLED.value
            current_task.error = str(e)
            current_task.completed_at = datetime.now().isoformat()
    except Exception as e:
        # print stack trace
        print(traceback.format_exc())
        current_task.status = TaskStatus.FAILED.value
        current_task.error = str(e)
        current_task.completed_at = datetime.now().isoformat()

@app.get("/")
def root():
    return FileResponse("frontend/index.html")

@app.get("/api")
def api_root():
    return {"message": "Soccer Director HTTP API is running"}

@app.get("/games")
async def get_games():
    return {"games": [{'name': get_game_name(game.split('.')[1]), 'id': game.split('.')[1]} for game in os.listdir(GAME_DATA_DIR) if game.startswith('game.') and game.endswith('.yaml')]}

@app.post("/game")
async def create_game(game_obj: dict):
    print(f"create_game: {game_obj}")
    save_path = os.path.join(GAME_DATA_DIR, 'game.' + game_obj['id'] + '.yaml')
    if os.path.exists(save_path):
        raise HTTPException(status_code=400, detail="Game already exists")

    os.makedirs(GAME_DATA_DIR, exist_ok=True)
    with open(save_path, "w", encoding="utf-8") as f:
        yaml.dump(game_obj, f)

    return {"id": game_obj['id'], "saved": True}

@app.put("/game/{id}")
async def update_game(id: str, game_obj: dict):
    save_path = os.path.join(GAME_DATA_DIR, 'game.' + id + '.yaml')
    with open(save_path, "w", encoding="utf-8") as f:
        yaml.dump(game_obj, f)
    return {"id": id, "updated": True}


@app.get("/game/{id}")
async def get_game(id: str):
    print(f"get_game: {id}")
    save_path = os.path.join(GAME_DATA_DIR, 'game.' + id + '.yaml')
    with open(save_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

@app.post("/game/{id}/events/{segment}")
async def save_events(id: str, segment: int, request: dict):
    events = [Event.from_dict(event) for event in request.get('events', [])]
    save_path = os.path.join(GAME_DATA_DIR, f'events.{id}-{segment}.csv')

    Event.save_to_csv(save_path, events)

    return {"id": id, "saved": True}

@app.get("/game/{id}/events/{segment}")
async def get_events(id: str, segment: int):
    save_path = os.path.join(GAME_DATA_DIR, f'events.{id}-{segment}.csv')
    csv_events = Event.load_from_csv(save_path)
    return {"events": [event.to_dict() for event in csv_events]}

@app.post("/game/{id}/analyze/{segment}")
async def analyze_game(id: str, segment: int):
    game = Game(id, load_game_metadata(id), GAME_DATA_DIR)
    analyzer = EventAnalyzer(game, 1)
    analyzer.analyze()
    return {"id": id, "segment": segment, "analyzed": True}

@app.get("/game/{id}/comments/{segment}")
async def get_comments(id: str, segment: int):
    save_path = game_data_path(id, segment)
    if not os.path.exists(save_path):
        return []
    with open(save_path, 'rb') as f:
        game_data = pickle.load(f)

    comments = game_data['comments']

    return {"comments": comments}

@app.get("/game/{id}/comment/{segment}/{index}/voice")
async def get_comment_voice(id: str, segment: int, index: int):
    save_path = game_data_path(id, segment)
    with open(save_path, 'rb') as f:
        game_data = pickle.load(f)
    comment = game_data['comments'][index]
    voicer = Voicer(GAME_DATA_DIR, game_data['comments'])

    return FileResponse(voicer.make_text_voice(comment.text))

@app.post("/game/{id}/comments/{segment}/{index}")
async def save_comment(id: str, index: int, comment_obj: dict, segment: int):
    save_path = game_data_path(id, segment)
    with open(save_path, 'rb') as f:
        game_data = pickle.load(f)

    comment = game_data['comments'][index]
    comment.time = comment_obj['time']
    comment.text = comment_obj['text']
    game_data['comments'][index] = comment

    with open(save_path, 'wb') as f:
        pickle.dump(game_data, f)

    return comment

@app.post("/game/{id}/make/{segment}")
async def make_video(id: str, segment: int):
    global current_task
    with task_lock:
        # Check if there's already a task running
        if current_task and (current_task.status == TaskStatus.RUNNING or current_task.status == TaskStatus.PENDING):
            raise HTTPException(status_code=409, detail=f"Another task is already running for game: {current_task}")
        
        current_task = Task(id, [("analyzing", 10), ("output_video", 70), ("output_audio", 10), ("add_audio", 10)])
    
    # Start the task in a separate thread
    thread = threading.Thread(target=make_video_task, args=(id, segment))
    thread.daemon = True
    thread.start()
    
    return {"id": id, "task_id": id, "status": TaskStatus.PENDING.value, "message": "Video making task started"}

@app.get("/game/{id}/task/status")
async def get_task_status(id: str):
    return current_task and id == current_task.id and current_task.to_dict() or {}

@app.post("/game/{id}/task/cancel")
async def cancel_task(id: str):
    global current_task
    if current_task and id == current_task.id and (current_task.status == TaskStatus.RUNNING or current_task.status == TaskStatus.PENDING):
        current_task.cancel()
    
    return {
        "id": id,
        "task_id": id,
        "status": TaskStatus.CANCELLED.value,
        "message": f"Task for game {id} has been cancelled"
    }

@app.post("/game/{id}/clean")
async def clean_game(id: str):
    if os.path.exists(os.path.join(GAME_DATA_DIR, 'game.' + id + '.yaml')):
        os.remove(os.path.join(GAME_DATA_DIR, 'game.' + id + '.yaml'))

    for segment in range(1, 5):
        if os.path.exists(game_data_path(id, segment)):
            os.remove(game_data_path(id, segment))

    return {"id": id, "cleaned": True}

@app.post("/upload/presigned-url/{key}")
async def get_presigned_upload_url(key: str):
    return {"upload_url": get_upload_url(STORAGE_FOLDER + key)}

@app.post("/upload/{key}")
async def upload_file(key: str, file: UploadFile = File(...)):
    if not key.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")
    with open(os.path.join(GAME_DATA_DIR, key), "wb") as f:
        f.write(await file.read())
    return {"key": key, "uploaded": True}

@app.get("/videos")
async def get_videos():
    return {"videos": [{'name': filename, 'size': os.path.getsize(os.path.join(GAME_DATA_DIR, filename)), 'last_modified': os.path.getmtime(os.path.join(GAME_DATA_DIR, filename)) * 1000, 'access_url': f'/video/{filename}'} for filename in os.listdir(GAME_DATA_DIR) if filename.lower().endswith(tuple(VIDEO_EXTENSIONS))]}

@app.get("/video/{filename}")
async def get_video(filename: str):
    if not filename.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")
    return FileResponse(os.path.join(GAME_DATA_DIR, filename))

@app.delete("/video/{filename}")
async def delete_video(filename: str):
    if not filename.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")
    os.remove(os.path.join(GAME_DATA_DIR, filename))
    return {"filename": filename, "deleted": True}

def get_game_name(id: str):
    with open(os.path.join(GAME_DATA_DIR, 'game.' + id + '.yaml'), "r", encoding="utf-8") as f:
        return yaml.safe_load(f)['name']

def game_data_path(id: str, segment: int):
    return os.path.join(GAME_DATA_DIR, 'game.' + id + '-' + str(segment) + '.pkl')

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)