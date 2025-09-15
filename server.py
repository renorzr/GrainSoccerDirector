import dotenv
dotenv.load_dotenv()

import traceback
import re
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
from enum import Enum
from storage import list_objects, get_object_url, get_upload_url, delete_object
import uuid

GAME_DATA_DIR = os.getenv("GAME_DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "games"))
STORAGE_FOLDER = os.getenv("STORAGE_FOLDER", "games/")
VIDEO_REGEX = os.getenv("VIDEO_REGEX", r"\/(\.+\).mp4$")
VIDEO_EXTENSIONS = os.getenv("VIDEO_EXTENSIONS", "mp4,mov,avi,mkv").split(",")

# Task status enum
class TaskStatus(Enum):
    PENDING = "pending"
    RUNNING = "running"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

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
tasks = {}
current_task = None
task_lock = threading.Lock()

class CancellationFlag:
    def __init__(self):
        self._cancelled = False
        self._lock = threading.Lock()
    
    def cancel(self):
        with self._lock:
            self._cancelled = True
    
    def is_cancelled(self):
        with self._lock:
            return self._cancelled

def load_game_data(game_id: str):
    game_data = yaml.safe_load(open(os.path.join(GAME_DATA_DIR, 'game.' + game_id + '.yaml'), "r", encoding="utf-8"))
    if not game_data.get('main_video'):
        game_data['main_video'] = get_object_url(STORAGE_FOLDER + 'source.' + game_id + '.mp4')
    elif game_data.get('main_video').startswith('storage://'):
        key = game_data.get('main_video').split('storage://')[1]
        game_data['main_video'] = get_object_url(STORAGE_FOLDER + key)
    
    if not game_data.get('logo_video'):
        game_data['logo_video'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'logo.mp4')

    if not game_data.get('scoreboard'):
        game_data['scoreboard'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'scoreboard.yaml')

    return game_data

def make_video_task(game_id: str, cancellation_flag: CancellationFlag):
    """Background task to make video"""
    global current_task
    try:
        with task_lock:
            if current_task != game_id:
                return
            tasks[game_id]["status"] = TaskStatus.RUNNING.value
            tasks[game_id]["started_at"] = datetime.now().isoformat()
        
        # Load game data
        game = Game(game_id, load_game_data(game_id), GAME_DATA_DIR)
        
        # Analyze events
        analyzer = EventAnalyzer(game)
        analyzer.analyze()
        
        # Check if task was cancelled
        if cancellation_flag.is_cancelled():
            with task_lock:
                tasks[game_id]["status"] = TaskStatus.CANCELLED.value
                tasks[game_id]["completed_at"] = datetime.now().isoformat()
                if current_task == game_id:
                    current_task = None
            return
        
        # Edit video with cancellation support
        editor = Editor(game, cancellation_flag)
        editor.edit()
        
        # Mark as completed
        with task_lock:
            if current_task == game_id:
                tasks[game_id]["status"] = TaskStatus.COMPLETED.value
                tasks[game_id]["completed_at"] = datetime.now().isoformat()
                current_task = None
                
    except InterruptedError as e:
        # Handle cancellation
        with task_lock:
            tasks[game_id]["status"] = TaskStatus.CANCELLED.value
            tasks[game_id]["error"] = str(e)
            tasks[game_id]["completed_at"] = datetime.now().isoformat()
            if current_task == game_id:
                current_task = None
    except Exception as e:
        # print stack trace
        print(traceback.format_exc())
        with task_lock:
            tasks[game_id]["status"] = TaskStatus.FAILED.value
            tasks[game_id]["error"] = str(e)
            tasks[game_id]["completed_at"] = datetime.now().isoformat()
            if current_task == game_id:
                current_task = None

@app.get("/")
def root():
    return FileResponse("frontend/index.html")

@app.get("/api")
def api_root():
    return {"message": "Soccer Director HTTP API is running"}

@app.get("/games")
async def get_games():
    return {"games": [game.split('.')[1] for game in os.listdir(GAME_DATA_DIR) if game.startswith('game.') and game.endswith('.yaml')]}

@app.post("/game")
async def create_game(game_obj: dict):
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

@app.post("/game/{id}/events")
async def save_events(id: str, events: list):
    events = [Event.from_dict(event) for event in events]
    save_path = os.path.join(GAME_DATA_DIR, 'events.' + id + '.csv')

    Event.save_to_csv(save_path, events)

    return {"id": id, "saved": True}

@app.get("/game/{id}/events")
async def get_events(id: str):
    save_path = os.path.join(GAME_DATA_DIR, 'events.' + id + '.csv')
    csv_events = Event.load_from_csv(save_path)
    return {"events": [event.to_dict() for event in csv_events]}

@app.post("/game/{id}/analyze")
async def analyze_game(id: str):
    game = Game(id, load_game_data(id), GAME_DATA_DIR)
    analyzer = EventAnalyzer(game)
    analyzer.analyze()
    return analyzer.game.comments

@app.get("/game/{id}/comments")
async def get_comments(id: str):
    save_path = os.path.join(GAME_DATA_DIR, 'game.' + id + '.pkl')
    with open(save_path, 'rb') as f:
        game_data = pickle.load(f)
    return game_data['comments']

@app.post("/game/{id}/comments/{index}")
async def save_comment(id: str, index: int, comment_obj: dict):
    save_path = os.path.join(GAME_DATA_DIR, 'game.' + id + '.pkl')
    with open(save_path, 'rb') as f:
        game_data = pickle.load(f)

    comment = game_data['comments'][index]
    comment.time = comment_obj['time']
    comment.text = comment_obj['text']
    game_data['comments'][index] = comment

    with open(save_path, 'wb') as f:
        pickle.dump(game_data, f)

    return comment

@app.post("/game/{id}/make")
async def make_video(id: str):
    global current_task
    with task_lock:
        # Check if there's already a task running
        if current_task is not None:
            raise HTTPException(status_code=409, detail=f"Another task is already running for game: {current_task}")
        
        # Check if this game already has a task
        if id in tasks and tasks[id]["status"] in [TaskStatus.PENDING.value, TaskStatus.RUNNING.value]:
            raise HTTPException(status_code=409, detail=f"Task for game {id} is already {tasks[id]['status']}")
        
        # Create new task with cancellation flag
        current_task = id
        cancellation_flag = CancellationFlag()
        tasks[id] = {
            "status": TaskStatus.PENDING.value,
            "created_at": datetime.now().isoformat(),
            "started_at": None,
            "completed_at": None,
            "error": None,
            "cancellation_flag": cancellation_flag
        }
    
    # Start the task in a separate thread
    thread = threading.Thread(target=make_video_task, args=(id, cancellation_flag))
    thread.daemon = True
    thread.start()
    
    return {"id": id, "task_id": id, "status": TaskStatus.PENDING.value, "message": "Video making task started"}

@app.get("/game/{id}/task/status")
async def get_task_status(id: str):
    """Get the status of a video making task"""
    with task_lock:
        if id not in tasks:
            raise HTTPException(status_code=404, detail=f"No task found for game {id}")
        
        task_info = tasks[id].copy()
        # Remove cancellation_flag as it's not JSON serializable
        task_info.pop("cancellation_flag", None)
        return {
            "id": id,
            "task_id": id,
            **task_info
        }

@app.get("/tasks")
async def get_all_tasks():
    """Get status of all tasks"""
    with task_lock:
        # Remove cancellation_flag from all tasks as it's not JSON serializable
        serializable_tasks = {}
        for task_id, task_info in tasks.items():
            task_copy = task_info.copy()
            task_copy.pop("cancellation_flag", None)
            serializable_tasks[task_id] = task_copy
        
        return {
            "current_task": current_task,
            "tasks": serializable_tasks
        }

@app.post("/game/{id}/task/cancel")
async def cancel_task(id: str):
    """Cancel a running or pending task"""
    global current_task
    with task_lock:
        if id not in tasks:
            raise HTTPException(status_code=404, detail=f"No task found for game {id}")
        
        task_status = tasks[id]["status"]
        
        # Check if task can be cancelled
        if task_status in [TaskStatus.COMPLETED.value, TaskStatus.FAILED.value, TaskStatus.CANCELLED.value]:
            raise HTTPException(status_code=400, detail=f"Task for game {id} is already {task_status} and cannot be cancelled")
        
        # Cancel the task using cancellation flag
        if "cancellation_flag" in tasks[id]:
            tasks[id]["cancellation_flag"].cancel()
        
        # Update task status
        if current_task == id:
            current_task = None
        
        tasks[id]["status"] = TaskStatus.CANCELLED.value
        tasks[id]["completed_at"] = datetime.now().isoformat()
        
        return {
            "id": id,
            "task_id": id,
            "status": TaskStatus.CANCELLED.value,
            "message": f"Task for game {id} has been cancelled"
        }

@app.post("/game/{id}/clean")
async def clean_game(id: str):
    os.remove(os.path.join(GAME_DATA_DIR, 'events.' + id + '.csv'))
    os.remove(os.path.join(GAME_DATA_DIR, 'game.' + id + '.pkl'))
    os.remove(os.path.join(GAME_DATA_DIR, 'highlights.' + id + '.mp4'))
    os.remove(os.path.join(GAME_DATA_DIR, 'logo.' + id + '.mp4'))
    os.remove(os.path.join(GAME_DATA_DIR, 'game.' + id + '.mp4'))
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

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)