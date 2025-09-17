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
        self.logo_video = obj.get('logo_video', os.path.join(directory, 'logo.mp4'))
        self.brand_video = obj.get('brand_video', os.path.join(directory, 'brand.mp4'))
        self.bgm = obj.get('bgm', os.path.join(directory, 'bgm.mp3'))
        self.prev_time = parse_time(obj.get('prev_time', 0))
        self.narrator = obj.get('narrator', '云说')
        self.directory = directory

        with open(obj.get('scoreboard', os.path.join(directory, 'scoreboard.yaml')), 'r') as f:
            self.scoreboard_props = yaml.safe_load(f)
