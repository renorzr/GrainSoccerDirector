import dotenv
dotenv.load_dotenv()

import traceback
from fastapi import FastAPI, UploadFile, File, HTTPException, Request
from fastapi.responses import FileResponse, JSONResponse, Response
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
from utils import video_preview
from clips import make_final_video as _make_final_video

GAME_DATA_DIR = os.getenv("GAME_DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "games"))
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
make_video_task: Task = None
analyze_game_task: Task = None
task_lock = threading.Lock()


def load_game_metadata(game_id: str):
    game_data = yaml.safe_load(open(os.path.join(GAME_DATA_DIR, 'game.' + game_id + '.yaml'), "r", encoding="utf-8"))
    
    if not game_data.get('logo_video'):
        game_data['logo_video'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'logo.mp4')

    if not game_data.get('brand_video'):
        game_data['brand_video'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'brand.mp4')

    if not game_data.get('scoreboard'):
        game_data['scoreboard'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'scoreboard.yaml')

    return game_data

def run_make_video_task(game_id: str, segment: int):
    """Background task to make video"""
    global make_video_task
    try:
        make_video_task.start()
        
        # Load game data
        game = Game(game_id, load_game_metadata(game_id), GAME_DATA_DIR)
        
        make_video_task.update_progress("analyzing", 0, 1)
        # Analyze events
        analyzer = EventAnalyzer(game, segment, make_video_task)
        analyzer.analyze()
        
        make_video_task.update_progress("analyzing", 1, 1)
        
        # Edit video
        editor = Editor(game, segment, make_video_task)
        editor.edit()
        
        # Mark as completed
        make_video_task.complete()
                
    except InterruptedError as e:
        # Handle cancellation
        with task_lock:
            make_video_task.status = TaskStatus.CANCELLED.value
            make_video_task.error = str(e)
            make_video_task.completed_at = datetime.now().isoformat()
    except Exception as e:
        # print stack trace
        print(traceback.format_exc())
        make_video_task.status = TaskStatus.FAILED.value
        make_video_task.error = str(e)
        make_video_task.completed_at = datetime.now().isoformat()

def run_make_final_video_task(game_id: str):
    global make_video_task
    try:
        make_video_task.start()
        game = Game(game_id, load_game_metadata(game_id), GAME_DATA_DIR)
        _make_final_video(game, make_video_task)
        make_video_task.complete()
    except Exception as e:
        print(traceback.format_exc())
        make_video_task.status = TaskStatus.FAILED.value
        make_video_task.error = str(e)
        make_video_task.completed_at = datetime.now().isoformat()

def run_analyze_game_task(game_id: str, segment: int):
    global analyze_game_task
    try:
        analyze_game_task.start()
        game = Game(game_id, load_game_metadata(game_id), GAME_DATA_DIR)
        analyzer = EventAnalyzer(game, segment, analyze_game_task)
        analyzer.analyze(force=True)
        analyze_game_task.complete()
    except InterruptedError as e:
        analyze_game_task.status = TaskStatus.CANCELLED.value
        analyze_game_task.error = str(e)
        analyze_game_task.completed_at = datetime.now().isoformat()
    except Exception as e:
        print(traceback.format_exc())
        analyze_game_task.status = TaskStatus.FAILED.value
        analyze_game_task.error = str(e)
        analyze_game_task.completed_at = datetime.now().isoformat()

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
    global analyze_game_task
    if analyze_game_task and (analyze_game_task.status == TaskStatus.RUNNING or analyze_game_task.status == TaskStatus.PENDING):
        raise HTTPException(status_code=409, detail=f"Another task is already running for game: {analyze_game_task}")

    analyze_game_task = Task(id, "analyze_game", [("analyzing", 100)])
    thread = threading.Thread(target=run_analyze_game_task, args=(id, segment))
    thread.daemon = True
    thread.start()
    return {"id": id, "task_id": id, "status": TaskStatus.PENDING.value, "message": "Analyzing game task started"}

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
    global make_video_task
    with task_lock:
        # Check if there's already a task running
        if make_video_task and (make_video_task.status == TaskStatus.RUNNING or make_video_task.status == TaskStatus.PENDING):
            raise HTTPException(status_code=409, detail=f"Another task is already running for game: {make_video_task}")
        
        make_video_task = Task(id, f"make_video_{segment}", [("analyzing", 10), ("output_video", 70), ("make_voice", 5), ("output_audio", 5), ("add_audio", 10)])
    
    # Start the task in a separate thread
    thread = threading.Thread(target=run_make_video_task, args=(id, segment))
    thread.daemon = True
    thread.start()
    
    return {"id": id, "task_id": id, "status": TaskStatus.PENDING.value, "message": "Video making task started"}

@app.post("/game/{id}/final")
async def make_final_video(id: str):
    global make_video_task
    with task_lock:
        if make_video_task and (make_video_task.status == TaskStatus.RUNNING or make_video_task.status == TaskStatus.PENDING):
            raise HTTPException(status_code=409, detail=f"Another task is already running for game: {make_video_task}")
        
        make_video_task = Task(id, "make_final_video", [("chunk", 50), ("frame_index", 50)])
    
    thread = threading.Thread(target=run_make_final_video_task, args=(id,))
    thread.daemon = True
    thread.start()
    
    return {"id": id, "task_id": id, "status": TaskStatus.PENDING.value, "message": "Final video making task started"}

@app.get("/game/{id}/task/{task_name}/status")
async def get_task_status(id: str, task_name: str):
    if task_name == "make_video":
        return make_video_task and id == make_video_task.id and make_video_task.to_dict() or {}
    elif task_name == "analyze_game":
        return analyze_game_task and id == analyze_game_task.id and analyze_game_task.to_dict() or {}

@app.post("/game/{id}/task/{task_name}/cancel")
async def cancel_task(id: str, task_name: str):
    global make_video_task, analyze_game_task
    if task_name == "make_video" and make_video_task and id == make_video_task.id and (make_video_task.status == TaskStatus.RUNNING or make_video_task.status == TaskStatus.PENDING):
        make_video_task.cancel()
    elif task_name == "analyze_game" and analyze_game_task and id == analyze_game_task.id and (analyze_game_task.status == TaskStatus.RUNNING or analyze_game_task.status == TaskStatus.PENDING):
        analyze_game_task.cancel()
    
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

@app.get("/video/{filename}/preview")
async def get_video_preview(filename: str, request: Request):
    filepath = os.path.join(GAME_DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video file not found")

    size = request.query_params.get('size', "200,150")
    size = tuple(int(size) for size in size.split(','))
    
    preview_data = video_preview(filepath, size)
    if preview_data is None:
        raise HTTPException(status_code=500, detail="Failed to generate video preview")
    
    return Response(content=preview_data, media_type="image/jpeg")

@app.head("/video/{filename}/preview")
async def head_video_preview(filename: str):
    filepath = os.path.join(GAME_DATA_DIR, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video file not found")
    return Response(status_code=200)

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