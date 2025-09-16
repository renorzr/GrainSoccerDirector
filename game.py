from utils import parse_time
from team import Team
from event import Event, EventType
from scoreboard import Scoreboard
import os
import yaml

# Description: This file contains the Game class which is used to store the game data.
class Game:
    def __init__(self, game_id, obj, directory):
        self.game_id = game_id
        self.name = obj['name']
        self.start = 0
        self.end = None
        self.description = obj.get('description', '')
        self.comment_requirement = obj.get('comment_requirement')
        self.teams = [Team(obj['name'], obj['color'], obj.get('code'), obj.get('score', 0)) for obj in obj['teams']]
        self.videos = obj.get('videos', [])
        self.logo_img = obj.get('logo_img', find_logo_img(directory))
        self.logo_video = obj.get('logo_video', os.path.join(directory, 'logo.mp4'))
        self.brand_video = obj.get('brand_video', os.path.join(directory, 'brand.mp4'))
        self.bgm = obj.get('bgm', os.path.join(directory, 'bgm.mp3'))
        self.prev_time = parse_time(obj.get('prev_time', 0))
        self.narrator = obj.get('narrator', '云说')
        self.directory = directory

        with open(obj.get('scoreboard', os.path.join(directory, 'scoreboard.yaml')), 'r') as f:
            self.scoreboard_props = yaml.safe_load(f)

        self.load_start_and_end()

        self.score_updates.append(ScoreUpdate(self.start, self.teams[0].score, self.teams[1].score))

    def load_start_and_end(self):
        # find the first event with type 'start'
        for event in self.events:
            if event.type == EventType.Start:
                self.start = event.time
                break
        # find the last event with type 'end'
        for event in self.events:
            if event.type == EventType.End:
                self.end = event.time

    def game_time(self, time):
        return time - self.start + self.prev_time

class ScoreUpdate:
    def __init__(self, time, score0, score1):
        self.time = time
        self.score0 = score0
        self.score1 = score1

    def __repr__(self):
        return f"time: {self.time}, score0: {self.score0}, score1: {self.score1}"

def find_logo_img(directory):
    exts = ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'tiff', 'ico', 'webp']
    for ext in exts:
        path = os.path.join(directory, f'logo.{ext}')
        if os.path.exists(path):
            return path
    return None
