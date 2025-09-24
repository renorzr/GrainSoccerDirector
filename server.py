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
from utils import video_preview, events_path
from clips import make_final_video as _make_final_video, join_videos as _join_videos, trim_video as _trim_video, get_video_props

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
preprocess_video_task: Task = None
task_lock = threading.Lock()


def load_game_metadata(game_id: str):
    game_data = yaml.safe_load(open(os.path.join(GAME_DATA_DIR, game_id, 'game.yaml'), "r", encoding="utf-8"))
    game_data['directory'] = os.path.join(GAME_DATA_DIR, game_id)

    if not game_data.get('logo_video'):
        game_data['logo_video'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'logo.mp4')

    if not game_data.get('brand_video'):
        game_data['brand_video'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'brand.mp4')

    if not game_data.get('scoreboard'):
        game_data['scoreboard'] = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'resources', 'scoreboard.yaml')

    return game_data

def run_join_videos_task(game_id: str, videos: list[str], output_file: str):
    global preprocess_video_task
    try:
        preprocess_video_task.start()
        game = Game(game_id, load_game_metadata(game_id))
        _join_videos(game, videos, output_file, preprocess_video_task)
        preprocess_video_task.complete()
    except Exception as e:
        print(traceback.format_exc())
        preprocess_video_task.status = TaskStatus.FAILED.value
        preprocess_video_task.error = str(e)
        preprocess_video_task.completed_at = datetime.now().isoformat()

def run_trim_video_task(game_id: str, video: str, start_time: float, end_time: float, output_file: str):
    global preprocess_video_task
    try:
        preprocess_video_task.start()
        game = Game(game_id, load_game_metadata(game_id))
        _trim_video(game, video, start_time, end_time, output_file, preprocess_video_task)
        preprocess_video_task.complete()
    except Exception as e:
        print(traceback.format_exc())
        preprocess_video_task.status = TaskStatus.FAILED.value
        preprocess_video_task.error = str(e)
        preprocess_video_task.completed_at = datetime.now().isoformat()


def run_make_video_task(game_id: str, segment: int):
    """Background task to make video"""
    global make_video_task
    try:
        make_video_task.start()
        
        # Load game data
        game = Game(game_id, load_game_metadata(game_id))
        
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
        game = Game(game_id, load_game_metadata(game_id))
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
        game = Game(game_id, load_game_metadata(game_id))
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
    return FileResponse("frontend/dist/index.html")

@app.get("/g/{game_id}")
def game_detail(game_id: str):
    return FileResponse(f"frontend/dist/index.html")

@app.get("/assets/{path:path}")
def assets(path: str):
    return FileResponse(f"frontend/dist/assets/{path}")

@app.get("/api")
def api_root():
    return {"message": "Soccer Director HTTP API is running"}

@app.get("/games")
async def get_games():
    return {"games": list(filter(lambda x: x['name'], [{'name': get_game_name(game_id), 'id': game_id} for game_id in os.listdir(GAME_DATA_DIR)]))}

@app.post("/game")
async def create_game(game_obj: dict):
    if get_game_name(game_obj['id']):
        raise HTTPException(status_code=400, detail="Game already exists")

    os.makedirs(os.path.join(GAME_DATA_DIR, game_obj['id']), exist_ok=True)
    with open(os.path.join(GAME_DATA_DIR, game_obj['id'], 'game.yaml'), "w", encoding="utf-8") as f:
        yaml.dump(game_obj, f)

    return {"id": game_obj['id'], "saved": True}

@app.put("/game/{id}")
async def update_game(id: str, game_obj: dict):
    save_path = os.path.join(GAME_DATA_DIR, id, 'game.yaml')
    with open(save_path, "w", encoding="utf-8") as f:
        yaml.dump(game_obj, f)
    return {"id": id, "updated": True}


@app.get("/game/{id}")
async def get_game(id: str):
    save_path = os.path.join(GAME_DATA_DIR, id, 'game.yaml')
    with open(save_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

@app.post("/game/{id}/events/{segment}")
async def save_events(id: str, segment: int, request: dict):
    events = [Event.from_dict(event) for event in request.get('events', [])]
    save_path = events_path(id, segment)

    Event.save_to_csv(save_path, events)

    return {"id": id, "saved": True}

@app.get("/game/{id}/events/{segment}")
async def get_events(id: str, segment: int):
    csv_events = Event.load_from_csv(events_path(id, segment))
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
    voicer = Voicer(os.path.join(GAME_DATA_DIR, id), game_data['comments'])

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
        
        make_video_task = Task(id, "make_final_video", [("chunk", 10), ("frame_index", 90)])
    
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
    elif task_name == "preprocess_video":
        return preprocess_video_task and id == preprocess_video_task.id and preprocess_video_task.to_dict() or {}

@app.post("/game/{id}/task/{task_name}/cancel")
async def cancel_task(id: str, task_name: str):
    global make_video_task, analyze_game_task
    if task_name == "make_video" and make_video_task and id == make_video_task.id and (make_video_task.status == TaskStatus.RUNNING or make_video_task.status == TaskStatus.PENDING):
        make_video_task.cancel()
    elif task_name == "analyze_game" and analyze_game_task and id == analyze_game_task.id and (analyze_game_task.status == TaskStatus.RUNNING or analyze_game_task.status == TaskStatus.PENDING):
        analyze_game_task.cancel()
    elif task_name == "preprocess_video" and preprocess_video_task and id == preprocess_video_task.id and (preprocess_video_task.status == TaskStatus.RUNNING or preprocess_video_task.status == TaskStatus.PENDING):
        preprocess_video_task.cancel()
    
    return {
        "id": id,
        "task_id": id,
        "status": TaskStatus.CANCELLED.value,
        "message": f"Task for game {id} has been cancelled"
    }

@app.post("/videos/{id}/join")
async def join_videos(id: str, videos: list[str]):
    global preprocess_video_task
    with task_lock:
        if preprocess_video_task and (preprocess_video_task.status == TaskStatus.RUNNING or preprocess_video_task.status == TaskStatus.PENDING):
            raise HTTPException(status_code=409, detail=f"Another task is already running for game: {preprocess_video_task}")
        
        preprocess_video_task = Task(id, "join_videos", [("chunk", 10), ("frame_index", 90)])

    output_file = f'joined-{"-".join([os.path.basename(video).split(".")[0] for video in videos])}.mp4'
    thread = threading.Thread(target=run_join_videos_task, args=(id, videos, output_file))
    thread.daemon = True
    thread.start()

    return {"id": id, "task_id": id, "status": TaskStatus.PENDING.value, "message": "Join videos task started", 'output_file': output_file}

@app.post("/video/{game_id}/{filename}/trim")
async def trim_video(game_id: str, filename: str, start_time: float, end_time: float):
    global preprocess_video_task
    with task_lock:
        if preprocess_video_task and (preprocess_video_task.status == TaskStatus.RUNNING or preprocess_video_task.status == TaskStatus.PENDING):
            raise HTTPException(status_code=409, detail=f"Another task is already running for game: {preprocess_video_task}")

        preprocess_video_task = Task(game_id, "trim_video", [("chunk", 10), ("frame_index", 90)])

    output_file = f'trimmed-{os.path.basename(filename).split(".")[0]}.mp4'
    thread = threading.Thread(target=run_trim_video_task, args=(game_id, filename, start_time, end_time, output_file))
    thread.daemon = True
    thread.start()

    return {"id": game_id, "task_id": game_id, "status": TaskStatus.PENDING.value, "message": "Trim video task started", 'output_file': output_file}

@app.post("/game/{id}/clean")
async def clean_game(id: str):
    if os.path.exists(os.path.join(GAME_DATA_DIR, id, 'game.yaml')):
        os.remove(os.path.join(GAME_DATA_DIR, id, 'game.yaml'))

    for segment in range(1, 5):
        if os.path.exists(game_data_path(id, segment)):
            os.remove(game_data_path(id, segment))

    return {"id": id, "cleaned": True}

@app.post("/upload/{game_id}/{key}")
async def upload_file(game_id: str, key: str, file: UploadFile = File(...)):
    if not key.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")
    with open(os.path.join(GAME_DATA_DIR, game_id, key), "wb") as f:
        f.write(await file.read())
    return {"key": key, "uploaded": True}

@app.get("/videos/{game_id}")
async def get_videos(game_id: str):
    def path(game_id: str, filename: str):
        return os.path.join(GAME_DATA_DIR, game_id, filename)
    return {"videos": [{'name': filename, 'size': os.path.getsize(path(game_id, filename)), 'last_modified': os.path.getmtime(path(game_id, filename)) * 1000, **get_video_props(path(game_id, filename))} for filename in os.listdir(os.path.join(GAME_DATA_DIR, game_id)) if filename.lower().endswith(tuple(VIDEO_EXTENSIONS))]}

@app.get("/video/{game_id}/{filename}/preview")
async def get_video_preview(game_id: str, filename: str, request: Request):
    filepath = os.path.join(GAME_DATA_DIR, game_id, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video file not found")

    size = request.query_params.get('size', "200,150")
    size = tuple(int(size) for size in size.split(','))
    
    preview_data = video_preview(filepath, size)
    if preview_data is None:
        raise HTTPException(status_code=500, detail="Failed to generate video preview")
    
    return Response(content=preview_data, media_type="image/jpeg")

@app.head("/video/{game_id}/{filename}/preview")
async def head_video_preview(game_id: str, filename: str):
    filepath = os.path.join(GAME_DATA_DIR, game_id, filename)
    if not os.path.exists(filepath):
        raise HTTPException(status_code=404, detail="Video file not found")
    return Response(status_code=200)

@app.get("/video/{game_id}/{filename}")
async def get_video(game_id: str, filename: str):
    if not filename.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")
    return FileResponse(os.path.join(GAME_DATA_DIR, game_id, filename))

@app.post("/video/{game_id}/{filename}/rename")
async def rename_video(game_id: str, filename: str, new_filename: str):
    if not filename.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")

    if not new_filename.split(".")[1].lower() == filename.split(".")[1].lower():
        raise HTTPException(status_code=400, detail="File type mismatch")

    filepath = os.path.join(GAME_DATA_DIR, game_id, filename)
    os.rename(filepath, os.path.join(GAME_DATA_DIR, game_id, new_filename))
    return {"filename": filename, "new_filename": new_filename, "renamed": True}

@app.delete("/video/{game_id}/{filename}")
async def delete_video(game_id: str, filename: str):
    if not filename.lower().endswith(tuple(VIDEO_EXTENSIONS)):
        raise HTTPException(status_code=400, detail="Invalid file type")
    os.remove(os.path.join(GAME_DATA_DIR, game_id, filename))
    return {"filename": filename, "deleted": True}

def get_game_name(id: str):
    try:
        with open(os.path.join(GAME_DATA_DIR, id, 'game.yaml'), "r", encoding="utf-8") as f:
            return yaml.safe_load(f).get('name')
    except Exception as e:
        return None

def game_data_path(id: str, segment: int):
    return os.path.join(GAME_DATA_DIR, id, f'game.{segment}.pkl')

if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)
