from utils import parse_time
from team import Team
from event import Event, EventType
from scoreboard import Scoreboard
import os
import yaml

# Description: This file contains the Game class which is used to store the game data.
class Game:
    def __init__(self, game_id, obj):
        self.game_id = game_id
        self.name = obj['name']
        self.start = 0
        self.end = None
        self.description = obj.get('description', '')
        self.comment_requirement = obj.get('comment_requirement')
        self.teams = [Team(obj['name'], obj['color'], obj.get('code')) for obj in obj['teams']]
        self.videos = obj.get('videos', [])
        self.logo_video = obj.get('logo_video')
        self.brand_video = obj.get('brand_video')
        self.bgm = obj.get('bgm')
        self.prev_time = parse_time(obj.get('prev_time', 0))
        self.narrator = obj.get('narrator', '云说')
        self.directory = obj['directory']

        with open(obj.get('scoreboard'), 'r', encoding='utf-8') as f:
            self.scoreboard_props = yaml.safe_load(f)
