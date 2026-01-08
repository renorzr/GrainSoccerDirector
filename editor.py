import logging
import subprocess
import os
from voicer import Voicer
from utils import format_time, events_path, load_game_data
from event import Event, EventType
from event import Tag
import cv2
from scoreboard import Scoreboard
import glob
from clips import get_duration, trim_clip
from logo_drawer import LogoDrawer
from constants import GOAL_DURATION, TEMP_VIDEO_NAME, TEMP_AUDIO_NAME, REPLAY_BUFFER, INTERRUPT_BUFFER


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
        self.segment = segment
        game_data = load_game_data(self.game.game_id, self.segment)
        self.comments = game_data['comments']
        self.voicer = Voicer(game.directory, self.comments)
        self.score_updates = game_data['score_updates']
        self.deadballs = game_data['deadballs']
        self.events = Event.load_from_csv(events_path(self.game.game_id, self.segment))
        self.start_time = game_data['start_time']
        self.end_time = game_data['end_time']

    def game_video(self, segment):
        return os.path.join(self.game.directory, self.game.videos[segment - 1])


    def edit(self):
        self.create_output_video()
        
        if self.is_cancelled():
            raise InterruptedError("Video editing was cancelled")
            
        self.create_output_audio()
        
        if self.is_cancelled():
            raise InterruptedError("Video editing was cancelled")
            
        self.add_audio_for_goal_clips()
        self.add_audio()

    def create_output_video(self):
        temp_video_path = os.path.join(self.game.directory, TEMP_VIDEO_NAME)
        print(f"creating output video {temp_video_path} from {self.game_video(self.segment)}")

        replay_events = self.calculate_replay_times()
        print(f"found {len(replay_events)} replay events")
        self.calculate_logo_times(replay_events)

        logo_video_path = self.game.logo_video if os.path.isabs(self.game.logo_video) else os.path.join(self.game.directory, self.game.logo_video)
        logo_drawer = LogoDrawer(logo_video_path, self.logo_times)

        cap = cv2.VideoCapture(self.game_video(self.segment))
        fps = cap.get(cv2.CAP_PROP_FPS)
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        self.end_time = self.end_time or cap.get(cv2.CAP_PROP_FRAME_COUNT) / fps
        out = cv2.VideoWriter(temp_video_path, cv2.VideoWriter_fourcc(*'h264'), fps, (width, height))
        if not out.isOpened():
            raise RuntimeError("Failed to open video writer")
        replay_frames = []
        replay_time = None
        processing_replay_event = None
        frame_count = 0
        goal_out = None
        goal_start_time = None

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
                    replay_frame = frame.copy()
                    replay_frames.append(replay_frame)
                    replay_frames.append(replay_frame)
                    if processing_replay_event.type == EventType.Goal:
                        goal_out = cv2.VideoWriter(os.path.join(self.game.directory, f'silent-goal-{self.game.game_id}-{self.segment}-{format_time(processing_replay_event.time, 1, False)}.mp4'), cv2.VideoWriter_fourcc(*'h264'), fps, (width, height))
                        if not goal_out.isOpened():
                            raise RuntimeError("Failed to open goal video writer")
                        goal_start_time = processing_replay_event.time
            else:
                if time > processing_replay_event.time - REPLAY_BUFFER and time < processing_replay_event.time + REPLAY_BUFFER:
                    replay_frame = frame.copy()
                    replay_frames.append(replay_frame)
                    replay_frames.append(replay_frame)
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

            if goal_out is not None:
                goal_out.write(frame)
                if time > goal_start_time + GOAL_DURATION:
                    goal_out.release()
                    goal_out = None
                    goal_start_time = None

            logo_drawer.draw_logo(time, frame)

            if frame_count % 10 == 0:
                print(f"frame {frame_count} / {cap.get(cv2.CAP_PROP_FRAME_COUNT)}", end="\r")
            out.write(frame)

        out.release()  # release the cv2's VideoWriter
        cap.release()

    def create_output_audio(self):
        temp_audio_path = os.path.join(self.game.directory, TEMP_AUDIO_NAME)
        print(f"creating output audio {TEMP_AUDIO_NAME} using FFmpeg streaming")
        
        # 1. 首先生成所有语音文件
        self.voicer.make_voice(self.task)
        
        # 2. 处理音频重叠和中断逻辑
        processed_comments = self._process_audio_overlaps()
        
        # 3. 使用FFmpeg进行流式音频混合
        self._create_audio_with_ffmpeg(processed_comments, temp_audio_path)
    
    def _process_audio_overlaps(self):
        """处理音频重叠和中断逻辑，返回处理后的评论列表"""
        processed_comments = []
        last_comment = None
        comment_count = 0
        
        for comment in self.comments:
            comment_count += 1
            self.update_progress("output_audio", comment_count, len(self.comments))
            
            if self.is_cancelled():
                print("Audio processing was cancelled")
                raise InterruptedError("Audio processing was cancelled")
                
            if not comment.text:
                continue
                
            # 检查是否与上一个评论重叠
            if last_comment is not None:
                last_comment_end = last_comment.time + last_comment.duration
                if comment.time < last_comment_end:
                    logging.info("overlapping comments, handling overlap")
                    if comment.event_level < last_comment.event_level:
                        logging.info(f"skipping comment {comment.text} (lower level)")
                        continue
                    
                    # 处理中断逻辑
                    if last_comment.time < comment.time - INTERRUPT_BUFFER:
                        logging.info(f"interrupting last comment {last_comment.text}")
                        # 截断上一个评论的持续时间
                        last_comment.duration = comment.time - last_comment.time - INTERRUPT_BUFFER
                    else:
                        logging.info(f"removing last comment {last_comment.text}")
                        # 移除上一个评论
                        processed_comments.pop()
                        last_comment = None
            
            # 获取语音文件信息
            voice_info = self.voicer.get_voice(comment.text)
            if voice_info["duration"] > 0:
                # 动态添加duration属性到comment对象
                comment.duration = voice_info["duration"]
                processed_comments.append(comment)
                last_comment = comment
                logging.info(f"Adding voice for comment {comment.text} at {comment.time}")
        
        return processed_comments
    
    def _create_audio_with_ffmpeg(self, comments, output_path):
        """使用FFmpeg进行流式音频混合"""
        if not comments:
            # 如果没有评论，直接提取原始视频音频
            cmd = [
                'ffmpeg', '-y',
                '-i', self.game_video(self.segment),
                '-c:a', 'aac', '-b:a', '128k',
                output_path
            ]
        else:
            # 构建FFmpeg命令
            cmd = ['ffmpeg', '-y']
            
            # 添加输入文件
            cmd.extend(['-i', self.game_video(self.segment)])  # 原始视频音频
            
            # 添加所有语音文件
            for comment in comments:
                voice_path = self.voicer.get_voice(comment.text)["path"]
                cmd.extend(['-i', voice_path])
            
            # 构建音频滤镜
            filter_parts = []
            mix_inputs = "[0:a]"  # 原始音频
            
            for i, comment in enumerate(comments):
                # 为每个语音文件创建延迟和音量调整滤镜
                delay_ms = int(comment.time * 1000)
                filter_parts.append(f"[{i+1}]adelay={delay_ms}:all=1,volume=2.0[a{i+1}]")
                mix_inputs += f"[a{i+1}]"
            
            # 合并所有音频流
            filter_complex = ";".join(filter_parts) + f";{mix_inputs}amix=inputs={len(comments)+1}:duration=longest[out]"
            
            cmd.extend([
                '-filter_complex', filter_complex,
                '-map', '[out]',
                '-c:a', 'aac', '-b:a', '128k',
                output_path
            ])
        
        # 执行FFmpeg命令
        try:
            result = subprocess.run(cmd, capture_output=True, text=True, check=True)
            logging.info(f"FFmpeg audio processing completed successfully")
        except subprocess.CalledProcessError as e:
            logging.error(f"FFmpeg audio processing failed: {e}")
            logging.error(f"FFmpeg stderr: {e.stderr}")
            raise RuntimeError(f"Audio processing failed: {e.stderr}")

    def add_audio_for_goal_clips(self):
        goal_clip_paths = glob.glob(os.path.join(self.game.directory, 'silent-goal-*.mp4'))
        for goal_clip_path in goal_clip_paths:
            try:
                print(f"adding audio to goal clip {goal_clip_path}")
                time_str = goal_clip_path.split('-').pop().split('.')[0]
                goal_time = int(time_str[0:2]) * 60 + int(time_str[2:4]) + int(time_str[4:5]) / 10

                # get duration of goal clip
                duration = get_duration(goal_clip_path)

                # trim audio to goal time
                goal_audio_path = os.path.join(self.game.directory, f'goal-{time_str}.aac')
                temp_audio_path = os.path.join(self.game.directory, TEMP_AUDIO_NAME)
                start_time = goal_time - REPLAY_BUFFER
                end_time = start_time + duration
                trim_clip(temp_audio_path, start_time, end_time, goal_audio_path)

                # add audio to goal clip
                command = f"ffmpeg -i {goal_clip_path} -i {goal_audio_path} -c:v copy -c:a aac -strict experimental {goal_clip_path.replace('silent-', '')} -y"
                subprocess.run(command, shell=True)
                os.remove(goal_clip_path)
                os.remove(goal_audio_path)
            except Exception as e:
                logging.error(f"Error adding audio to goal clip {goal_clip_path}: {e}")

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
            self.logo_times.append(replay_event.replay_time)
            self.logo_times.append(replay_event.replay_time + REPLAY_BUFFER * 4)

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