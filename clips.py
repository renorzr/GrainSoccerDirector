import cv2
import os
import subprocess
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

#def join_videos(game, videos, output_file, task=None):
#    print(f'Joining videos: {videos} -> {output_file}')
#    with open(os.path.join(game.directory, 'list.txt'), 'w') as f:
#        for video in videos:
#            f.write(f'file {video}\n')
#    subprocess.run(['ffmpeg', '-f', 'concat', '-safe', '0', '-i', list_file, '-c', 'copy', output_file], cwd=game.directory)
#
#    return output_file

#def trim_video(game, video, start_time, end_time, output_file, task=None):
#    subprocess.run(['ffmpeg', '-i', os.path.join(game.directory, video), '-ss', format_ffmpeg_time(start_time), '-to', format_ffmpeg_time(end_time), os.path.join(game.directory, output_file)])
#
#    return output_file

def format_ffmpeg_time(time: float):
    return f'{int(time // 3600)}:{int((time % 3600) // 60)}:{int(time % 60)}'

def join_videos(game, videos, output_file, task=None):
    clips = [VideoFileClip(os.path.join(game.directory, video)) for video in videos]
    fps = clips[0].fps
    game_clip = concatenate_videoclips(clips, method='chain')
    game_clip.write_videofile(os.path.join(game.directory, output_file), threads=32, fps=fps, preset='ultrafast', logger=task and MyBarLogger(task) or None)

    return output_file

def trim_video(game, video, start_time, end_time=None, task=None):
    video_clip = VideoFileClip(os.path.join(game.directory, video))
    video_clip = video_clip.subclip(start_time, end_time)
    video_clip.write_videofile(os.path.join(game.directory, video), threads=32, fps=video_clip.fps, preset='ultrafast', logger=task and MyBarLogger(task) or None)

    return video

def get_video_props(file):
    cap = cv2.VideoCapture(file)
    return {
        'fps': cap.get(cv2.CAP_PROP_FPS),
        'frame_count': cap.get(cv2.CAP_PROP_FRAME_COUNT),
        'duration': cap.get(cv2.CAP_PROP_FRAME_COUNT) / cap.get(cv2.CAP_PROP_FPS)
    }