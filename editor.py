import logging
import subprocess
from moviepy import VideoFileClip, AudioFileClip, CompositeVideoClip, CompositeAudioClip, ImageClip, concatenate_videoclips, TextClip
from moviepy.video.fx import MultiplySpeed, Resize, CrossFadeIn, CrossFadeOut
import numpy as np
import os
from voicer import Voicer
from utils import format_time, events_path, load_game_data
from event import Event
from event import Tag, EventType
import cv2
from scoreboard import Scoreboard

PREVIEW_BUFFER = 2
DELAY_BEFORE_REPLAY = 6
REPLAY_BUFFER = 2
HIGHLIGHT_EXTEND = 3
INTERRUPT_BUFFER = 0.5
LOGO_STAY = 0.5
LOGO_FLY = 0.8
TEMP_VIDEO_NAME = 'temp.mp4'
TEMP_AUDIO_NAME = 'temp.aac'

# 剪辑器
class Editor:
    # 初始化剪辑器
    def __init__(self, game, segment, task=None):
        self.game = game
        self.logo_clips = []
        self.replay_clips = []
        self.scoreboard_clips = []
        self.comment_audio = None
        self.current_score = None
        self.logo_times = None
        self.task = task
        self.scoreboard = Scoreboard.from_dict(
            {'title': self.game.name, 'team0': self.game.teams[0].name, 'team1': self.game.teams[1].name, 'segment': segment}, 
            self.game.scoreboard_props)
        self.load_logo_video()
        self.segment = segment
        game_data = load_game_data(self.game.game_id, self.segment)
        self.comments = game_data['comments']
        self.voicer = Voicer(game.directory, self.comments)
        self.score_updates = game_data['score_updates']
        self.deadballs = game_data['deadballs']
        self.events = Event.load_from_csv(events_path(self.game.game_id, self.segment))
        self.start_time = game_data['start_time']
        self.end_time = game_data['end_time']

    def load_logo_video(self):
        logo_video_path = self.game.logo_video if os.path.isabs(self.game.logo_video) else os.path.join(self.game.directory, self.game.logo_video)
        logo_video_cap = cv2.VideoCapture(logo_video_path)
        fps = logo_video_cap.get(cv2.CAP_PROP_FPS)
        frames = []
        while True:
            ret, frame = logo_video_cap.read()
            if not ret:
                break
            frames.append(frame)

        duration = len(frames) / fps
        logo_video_cap.release()
        self.logo_video = {"fps": fps, "duration": duration, "frames": frames}
        print(f"loading logo video {logo_video_path} with {self.logo_video['fps']} fps and {self.logo_video['duration']} duration")

    def game_video(self, segment):
        return os.path.join(self.game.directory, self.game.videos[segment - 1])


    def edit(self):
        self.create_output_video()
        
        if self.is_cancelled():
            raise InterruptedError("Video editing was cancelled")
            
        self.create_output_audio()
        
        if self.is_cancelled():
            raise InterruptedError("Video editing was cancelled")
            
        self.add_audio()

    def create_output_video(self):
        temp_video_path = os.path.join(self.game.directory, TEMP_VIDEO_NAME)
        print(f"creating output video {temp_video_path} from {self.game_video(self.segment)}")

        replay_events = self.calculate_replay_times()
        print(f"found {len(replay_events)} replay events")
        self.calculate_logo_times(replay_events)

        cap = cv2.VideoCapture(self.game_video(self.segment))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.end_time = self.end_time or cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        out = cv2.VideoWriter(temp_video_path, cv2.VideoWriter_fourcc(*'vp80'), fps, (width, height))
        replay_frames = []
        replay_time = None
        processing_replay_event = None
        frame_count = 0

        while True:
            # 检查是否被取消
            self.update_progress("output_video", frame_count, cap.get(cv2.CAP_PROP_FRAME_COUNT))
            if self.is_cancelled():
                print("Video processing was cancelled")
                out.release()
                cap.release()
                raise InterruptedError("Video processing was cancelled")
                
            ret, frame = cap.read()
            if not ret:
                break

            time = frame_count / fps

            if processing_replay_event is None:
                first_replay_event_time = len(replay_events) > 0 and replay_events[0].time or -100
                if time > first_replay_event_time - REPLAY_BUFFER and time < first_replay_event_time + REPLAY_BUFFER:
                    processing_replay_event = replay_events.pop(0)
                    print(f"processing replay event {processing_replay_event.type.name} {format_time(processing_replay_event.time)}")
                    replay_frames.append(frame.copy())
                    replay_frames.append(frame.copy())
            else:
                if time > processing_replay_event.time - REPLAY_BUFFER and time < processing_replay_event.time + REPLAY_BUFFER:
                    replay_frames.append(frame.copy())
                    replay_frames.append(frame.copy())
                else:
                    print(f"processed replay event {processing_replay_event.type.name} {format_time(processing_replay_event.time)}")
                    replay_time = processing_replay_event.replay_time
                    processing_replay_event = None

            if replay_time is not None and time > replay_time:
                if len(replay_frames) > 0:
                    frame = replay_frames.pop(0)
                else:
                    replay_time = None

            frame_count += 1

            self.draw_scoreboard(time, frame)
            self.draw_logo(time, frame)
            if frame_count % 10 == 0:
                print(f"frame {frame_count} / {cap.get(cv2.CAP_PROP_FRAME_COUNT)}", end="\r")
            out.write(frame)

        out.release()  # release the cv2's VideoWriter
        cap.release()

    def create_output_audio(self):
        temp_audio_path = os.path.join(self.game.directory, TEMP_AUDIO_NAME)
        print(f"creating output audio {TEMP_AUDIO_NAME}")
        self.voicer.make_voice(self.task)
        audio_clips = [VideoFileClip(self.game_video(self.segment)).audio]
        last_comment = None
        comment_count = 0
        for comment in self.comments:
            comment_count += 1
            self.update_progress("output_audio", comment_count, len(self.comments))
            if self.is_cancelled():
                print("Video processing was cancelled")
                raise InterruptedError("Video processing was cancelled")

            if not comment.text:
                continue
            voice_path = self.voicer.get_voice(comment.text)["path"]
            logging.info(f"voice path: {voice_path}")
            voice_clip = AudioFileClip(voice_path).with_volume_scaled(2)
            last_comment_end = last_comment.time + audio_clips[-1].duration if last_comment else 0
            if comment.time < last_comment_end:
                logging.info("overlapping comments, skipping lower level")
                if comment.event_level < last_comment.event_level:
                    logging.info(f"skipping comment {comment.text}")
                    continue
                if last_comment.time < comment.time - INTERRUPT_BUFFER:
                    logging.info(f"interrupt last comment {last_comment.text}")
                    audio_clips[-1] = audio_clips[-1].subclipped(0, comment.time - last_comment.time - INTERRUPT_BUFFER)
                else:
                    logging.info(f"skipping last comment {last_comment.text}")
                    audio_clips.pop()
                    last_comment = None

            logging.info(f"Adding voice for comment {comment.text} at {comment.time}")
            audio_clips.append(voice_clip.with_start(comment.time))
            last_comment = comment
        CompositeAudioClip(audio_clips).write_audiofile(temp_audio_path, codec="aac")

    def add_audio(self):
        self.update_progress("add_audio", 0, 1)
        temp_video_path = os.path.join(self.game.directory, TEMP_VIDEO_NAME)
        temp_audio_path = os.path.join(self.game.directory, TEMP_AUDIO_NAME)
        output_video_path = os.path.join(self.game.directory, f'output-{self.segment}.mp4')
        command = f"ffmpeg -i {temp_video_path} -i {temp_audio_path} -c:v copy -c:a aac -strict experimental {output_video_path} -y"
        subprocess.run(command, shell=True)
        os.remove(temp_video_path)
        os.remove(temp_audio_path)

    def draw_scoreboard(self, time, frame):
        if time < self.start_time or time > self.end_time:
            return

        if len(self.score_updates) > 0 and time > self.score_updates[0][0]:
            self.current_score = self.score_updates.pop(0)

        if self.current_score is not None:
            (_, score0, score1) = self.current_score
            self.scoreboard.render_frame(frame, time - self.start_time, score0, score1)

    def calculate_logo_times(self, replay_events):
        self.logo_times = []
        for replay_event in replay_events:
            self.logo_times.append(replay_event.replay_time - self.logo_video["duration"] / 2)
            self.logo_times.append(replay_event.replay_time + REPLAY_BUFFER * 4 - self.logo_video["duration"] / 2)

    def draw_logo(self, time, frame):
        first_logo_time = len(self.logo_times) > 0 and self.logo_times[0] or None

        if first_logo_time is None:
            return

        if time > first_logo_time + self.logo_video["duration"]:
            print(f"logo time {first_logo_time} + {self.logo_video['duration']} is past, popping logo time")
            if len(self.logo_times) > 0:
                self.logo_times.pop(0)
            return;

        if time >= first_logo_time:
            logo_time = time - first_logo_time
            logo_frame_index = int(logo_time * self.logo_video["fps"])
            logo_frame = self.logo_video["frames"][logo_frame_index]
            if logo_time < LOGO_FLY / 2:
                alpha = 1 - logo_time / (LOGO_FLY / 2)
            elif logo_time > self.logo_video["duration"] - LOGO_FLY / 2:
                alpha = 1 - (self.logo_video["duration"] - logo_time) / (LOGO_FLY / 2)
            else:
                alpha = 0

            cv2.addWeighted(frame, alpha, logo_frame, 1 - alpha, 0, frame)

    # 计算重放片段的时间
    def calculate_replay_times(self):
        print(f"calculating replay times for {len(self.events)} events in {self.game.videos[self.segment - 1]}")
        # 获取所有需要重放的事件
        replay_events = [e for e in self.events if Tag.Replay in e.tags]
        print(f"found {len(replay_events)} replay events")
        if not replay_events:
            return []

        # 获取所有deadball时间段
        deadballs = self.deadballs
        print(f"found {len(deadballs)} deadballs")
        if not deadballs:
            return []

        # 按时间正序排序deadball和重放事件
        deadballs.sort(key=lambda x: x.start)
        replay_events.sort(key=lambda x: x.time)

        replay_duration = REPLAY_BUFFER * 2 * 2

        for deadball in deadballs:
            logging.info(f"calculate replay in deadball [{format_time(deadball.start)}-{format_time(deadball.end)}]")
            # 如果deadball时间太短，跳过
            if deadball.duration < replay_duration:
                logging.info("duration is too short, skipping")
                continue
            
            # 找到deadball之前最近的事件
            nearest_event = None
            for event in replay_events:
                if event.time <= deadball.start:
                    if event.replay_time is None:
                        nearest_event = event
                else:
                    break
            
            if nearest_event:
                # 计算居中播放的时间
                center_time = deadball.start + (deadball.duration - replay_duration) / 2
                nearest_event.replay_time = center_time
                logging.info(f"replay event: {nearest_event.type.name} {format_time(nearest_event.time)} at {format_time(center_time)}")
        
        return [e for e in replay_events if e.replay_time]

    def update_progress(self, stage, progress, total):
        if self.task:
            self.task.update_progress(stage, progress, total)

    def is_cancelled(self):
        return self.task and self.task.is_cancelled()