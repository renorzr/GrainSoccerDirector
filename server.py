import dotenv
dotenv.load_dotenv()

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.responses import FileResponse, JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from game import Game
import uvicorn
import os
import yaml
import pickle
from event_analyzer import EventAnalyzer
from editor import Editor

GAME_DATA_DIR = os.getenv("GAME_DATA_DIR", "games")
print(f"GAME_DATA_DIR: {GAME_DATA_DIR}")

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

@app.get("/")
def root():
    return {"message": "Soccer Director HTTP API is running"}

@app.post("/game")
async def create_game(game_obj: dict):
    save_path = os.path.join(GAME_DATA_DIR, game_obj['id'] + '.yaml')
    if os.path.exists(save_path):
        raise HTTPException(status_code=400, detail="Game already exists")

    os.makedirs(GAME_DATA_DIR, exist_ok=True)
    with open(save_path, "w", encoding="utf-8") as f:
        yaml.dump(game_obj, f)

    return {"id": game_obj['id'], "saved": True}

@app.get("/game/{id}")
async def get_game(id: str):
    print(f"get_game: {id}")
    save_path = os.path.join(GAME_DATA_DIR, id + '.yaml')
    with open(save_path, "r", encoding="utf-8") as f:
        return yaml.safe_load(f)

@app.post("/game/{id}/events")
async def save_events(id: str, events: str):
    save_path = os.path.join(GAME_DATA_DIR, 'events.' + id + '.csv')
    with open(save_path, "w", encoding="utf-8") as f:
        f.write(events)

    try:
        Event.load_from_csv(save_path)
    except Exception as e:
        print(f"Error loading events: {e}")
        os.remove(save_path)
        return {"id": id, "saved": False}

    return {"id": id, "saved": True}

@app.get("/game/{id}/events")
async def get_events(id: str):
    save_path = os.path.join(GAME_DATA_DIR, 'events.' + id + '.csv')
    with open(save_path, "r", encoding="utf-8") as f:
        return {"events": f.read()}

@app.post("/game/{id}/analyze")
async def analyze_game(id: str):
    game = Game(id, yaml.safe_load(open(os.path.join(GAME_DATA_DIR, id + '.yaml'), "r", encoding="utf-8")))
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
    game = Game(id, yaml.safe_load(open(os.path.join(GAME_DATA_DIR, id + '.yaml'), "r", encoding="utf-8")))
    editor = Editor(game)
    editor.edit()
    return {"id": id, "saved": True}

@app.post("/game/{id}/clean")
async def clean_game(id: str):
    os.remove(os.path.join(GAME_DATA_DIR, id + '.yaml'))
    os.remove(os.path.join(GAME_DATA_DIR, 'events.' + id + '.csv'))
    os.remove(os.path.join(GAME_DATA_DIR, 'game.' + id + '.pkl'))
    os.remove(os.path.join(GAME_DATA_DIR, 'highlights.' + id + '.mp4'))
    os.remove(os.path.join(GAME_DATA_DIR, 'logo.' + id + '.mp4'))
    os.remove(os.path.join(GAME_DATA_DIR, 'game.' + id + '.mp4'))
    return {"id": id, "cleaned": True}


if __name__ == "__main__":
    uvicorn.run(app, host="0.0.0.0", port=8000)