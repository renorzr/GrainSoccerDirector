import os
from proglog import ProgressBarLogger
from event import EventType
from moviepy import VideoFileClip, concatenate_videoclips
from utils import format_time


class MyBarLogger(ProgressBarLogger):

    def __init__(self, task):
        super().__init__()
        self.task = task
        self.chunk_total = None
        self.frame_total = None
    
    def callback(self, **changes):
        for (parameter, value) in changes.items():
            self.last_message = parameter
            print(f"MyBarLogger: {parameter} {value}")
    
    def bars_callback(self, bar, attr, value,old_value=None):
        if bar != "chunk" and attr != "index":
            print(f"MyBarLogger: {bar} {attr} {value} {old_value}")

        if bar == "chunk" and attr == "total":
            self.chunk_total = value
        if bar == "frame_index" and attr == "total":
            self.frame_total = value

        total = self.chunk_total if bar == "chunk" else self.frame_total
        if total:
            self.task.update_progress(bar, value, total)
        

def make_final_video(game, task=None):
    brand_clip = VideoFileClip(game.brand_video if os.path.isabs(game.brand_video) else os.path.join(game.directory, game.brand_video))
    clips = [brand_clip]
    for segment in range(1, len(game.videos) + 1):
        segment_path = os.path.join(game.directory, f'output-{segment}.mp4')
        if not os.path.exists(segment_path):
            raise FileNotFoundError(f'output-{segment}.mp4 not found')
        segment_clip = VideoFileClip(segment_path)
        clips.append(segment_clip)
        clips.append(brand_clip)

    game_clip = concatenate_videoclips(clips)
    game_clip.write_videofile(os.path.join(game.directory, f'final-{game.game_id}.mp4'), threads=32, fps=24, logger=task and MyBarLogger(task) or None)
