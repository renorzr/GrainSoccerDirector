import cv2
import os
import subprocess
from event import EventType
from utils import format_time
from replay_wipe_drawer import ReplayWipeDrawer
import glob
from constants import REPLAY_BUFFER


def make_final_video(game, task=None):
    # Create a list of video files to concatenate
    video_files = []
    
    # Add brand video
    brand_video_path = game.brand_video if os.path.isabs(game.brand_video) else os.path.join(game.directory, game.brand_video)
    brand_video_path = ensure_brand_video(game, brand_video_path)
    
    # Add segment videos with brand video between each
    for segment in range(1, len(game.videos) + 1):
        segment_path = os.path.join(game.directory, f'output-{segment}.mp4')
        if not os.path.exists(segment_path):
            raise FileNotFoundError(f'output-{segment}.mp4 not found')
        video_files.append(segment_path)
        video_files.append(brand_video_path)
    
    # All segment videos should already have unified fps from add_audio()
    # So we can use simple concat with copy codec for fast concatenation
    concat_file = os.path.join(game.directory, 'concat_list.txt')
    with open(concat_file, 'w') as f:
        for video_file in video_files:
            f.write(f"file '{video_file}'\n")
    
    # Use ffmpeg to concatenate videos with copy codec (fast, no re-encoding)
    output_file = os.path.join(game.directory, f'final-{game.game_id}.mp4')
    cmd = [
        'ffmpeg', '-y',  # -y to overwrite output file
        '-f', 'concat',
        '-safe', '0',
        '-i', concat_file,
        '-c', 'copy',  # Copy streams without re-encoding (fast)
        output_file
    ]
    
    print(f"Creating final video: {output_file}")
    print(f"Concatenating {len(video_files)} videos (all should have unified fps)")
    
    subprocess.run(cmd, check=True)
    
    # Clean up concat file
    os.remove(concat_file)

    make_goals_video(game, task)

def ensure_brand_video(game, brand_path: str) -> str:
    if not brand_path:
        raise FileNotFoundError('brand video/image not configured')

    if not os.path.exists(brand_path):
        raise FileNotFoundError(f'brand asset not found: {brand_path}')

    ext = os.path.splitext(brand_path)[1].lower()
    if ext in ['.mp4', '.mov', '.mkv', '.webm', '.avi']:
        return brand_path

    if ext not in ['.png', '.jpg', '.jpeg']:
        raise ValueError(f'unsupported brand asset type: {ext}')

    reference_video_path = os.path.join(game.directory, 'output-1.mp4')
    if not os.path.exists(reference_video_path):
        raise FileNotFoundError('output-1.mp4 not found for brand video sizing')

    output_path = os.path.join(game.directory, 'brand-generated.mp4')
    if os.path.exists(output_path):
        output_mtime = os.path.getmtime(output_path)
        if output_mtime >= os.path.getmtime(brand_path):
            return output_path

    width, height, fps = get_video_dimensions(reference_video_path)
    if width <= 0 or height <= 0:
        raise RuntimeError('failed to detect reference video resolution')
    if fps <= 0:
        fps = 25

    build_brand_video(brand_path, output_path, width, height, fps)
    return output_path

def get_video_dimensions(path: str) -> tuple[int, int, float]:
    cap = cv2.VideoCapture(path)
    if not cap.isOpened():
        cap.release()
        return 0, 0, 0
    width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    fps = cap.get(cv2.CAP_PROP_FPS)
    cap.release()
    return width, height, fps

def build_brand_video(brand_image_path: str, output_path: str, width: int, height: int, fps: float):
    duration = 2.5
    fade_in_start = 0.5
    fade_in_duration = 0.5
    hold_duration = 1.0
    fade_out_start = fade_in_start + fade_in_duration + hold_duration
    fade_out_duration = 0.5

    scale_w = f"iw*min(1\\,min({width}/iw\\,{height}/ih))"
    scale_h = f"ih*min(1\\,min({width}/iw\\,{height}/ih))"
    filter_complex = (
        f"[1:v]format=rgba,"
        f"scale={scale_w}:{scale_h},"
        f"fade=t=in:st={fade_in_start}:d={fade_in_duration}:alpha=1,"
        f"fade=t=out:st={fade_out_start}:d={fade_out_duration}:alpha=1[logo];"
        f"[0:v][logo]overlay=(W-w)/2:(H-h)/2:enable='between(t,{fade_in_start},{duration})'[v]"
    )

    cmd = [
        'ffmpeg', '-y',
        '-f', 'lavfi',
        '-i', f'color=c=black:s={width}x{height}:r={fps}:d={duration}',
        '-loop', '1',
        '-i', brand_image_path,
        '-t', str(duration),
        '-f', 'lavfi',
        '-i', 'anullsrc=channel_layout=stereo:sample_rate=44100',
        '-filter_complex', filter_complex,
        '-map', '[v]',
        '-map', '2:a',
        '-t', str(duration),
        '-r', str(fps),
        '-c:v', 'libx264',
        '-pix_fmt', 'yuv420p',
        '-c:a', 'aac',
        '-shortest',
        output_path,
    ]

    print(f"Creating brand video: {output_path}")
    subprocess.run(cmd, check=True)

def make_goals_video(game, task=None):
    goal_clip_paths = glob.glob(os.path.join(game.directory, 'goal-*.mp4'))
    goal_clip_paths.sort()
    replay_wipe_times = [0.0]  # type: list[float]
    for goal_clip_path in goal_clip_paths:
        replay_wipe_times.append(replay_wipe_times[-1] + get_duration(goal_clip_path) + REPLAY_BUFFER * 4)
    replay_wipe_image_path = game.replay_wipe_image if os.path.isabs(game.replay_wipe_image) else os.path.join(game.directory, game.replay_wipe_image)
    replay_wipe_drawer = ReplayWipeDrawer(replay_wipe_image_path, replay_wipe_times, game.replay_wipe, wipe_direction=game.replay_wipe_direction, wipe_zoom=game.replay_wipe_zoom)
    print(f"replay wipe times: {replay_wipe_times}")

    out_frame_count = 0
    out = None
    fps = 0
    for index, goal_clip_path in enumerate(goal_clip_paths):
        if task is not None:
            task.update_progress("make_goals_video", index, len(goal_clip_paths))
        print(f"making goals video {index} / {len(goal_clip_paths)} {goal_clip_path}")
        cap = cv2.VideoCapture(goal_clip_path)
        frames = []
        in_frame_count = 0
        while True:
            ret, frame = cap.read()
            if not ret:
                if len(frames) > 0:                 
                    frame = frames.pop(0)
                else:
                    break

            if not out:
                fps = cap.get(cv2.CAP_PROP_FPS)
                width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
                height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
                out = cv2.VideoWriter(os.path.join(game.directory, 'silent-goals.mp4'), cv2.VideoWriter_fourcc(*'h264'), fps, (width, height))
                if not out.isOpened():
                    raise RuntimeError("Failed to open video writer")

            in_time = in_frame_count / fps
            out_time = out_frame_count / fps
            in_frame_count += 1
            out_frame_count += 1

            if in_time < REPLAY_BUFFER * 2:
                replay_frame = frame.copy()
                frames.append(replay_frame)
                frames.append(replay_frame)

            replay_wipe_drawer.draw_replay_wipe(out_time, frame)
            out.write(frame)

        cap.release()
        print(f"made goals video {index} / {len(goal_clip_paths)} {goal_clip_path}")

    # Release VideoWriter before using the file with ffmpeg
    if out:
        out.release()
        out = None

    print("add audio to goals video")
    replay_wipe_times.pop()  # Remove the last element which is the total duration
    goal_clips_args = []
    for goal_clip_path in goal_clip_paths:
        goal_clips_args.append('-i')
        goal_clips_args.append(goal_clip_path)
    
    bgm_path = game.bgm if os.path.isabs(game.bgm) else os.path.join(game.directory, game.bgm)
    
    # Get video duration to limit BGM length
    silent_goals_path = os.path.join(game.directory, 'silent-goals.mp4')
    video_duration = get_duration(silent_goals_path)

    # Build filter_complex for audio mixing
    # Input 0: silent-goals.mp4 (video)
    # Input 1, 2, ...: goal clips (audio)
    # Input len(goal_clip_paths)+1: bgm (audio)
    filter_parts = []
    audio_labels = []
    for i, goal_clip_path in enumerate(goal_clip_paths):
        audio_input_index = i + 1  # Audio inputs start from index 1
        delay_ms = int(replay_wipe_times[i] * 1000)  # Convert seconds to milliseconds
        label = f'a{i}'
        audio_labels.append(label)
        # adelay format: adelay=delay_in_ms|delay_in_ms (for stereo, use same value for both channels)
        filter_parts.append(f'[{audio_input_index}:a]adelay={delay_ms}|{delay_ms}[{label}]')
    
    # Add BGM: trim to video duration, reduce volume to 0.15 (15%), and add 1 second fade out at the end
    bgm_input_index = len(goal_clip_paths) + 1
    bgm_trimmed_label = 'bgm_trimmed'
    bgm_label = 'bgm_faded'
    fade_start = max(0, video_duration - 1)  # Start fade 1 second before end
    # First trim and set volume
    filter_parts.append(f'[{bgm_input_index}:a]atrim=0:{video_duration},asetpts=PTS-STARTPTS,volume=0.15[{bgm_trimmed_label}]')
    # Then add fade out effect in the last 1 second
    filter_parts.append(f'[{bgm_trimmed_label}]afade=t=out:st={fade_start}:d=1[{bgm_label}]')
    
    # Mix all audio streams (goal clips + bgm)
    # BGM volume is set to 0.2 (20%) so it doesn't overpower goal clip audio
    # duration=longest ensures output matches longest input
    # dropout_transition=0 prevents fade in/out when inputs start/stop
    mix_inputs = ''.join([f'[{label}]' for label in audio_labels])
    filter_complex = ';'.join(filter_parts) + f';{mix_inputs}[{bgm_label}]amix=inputs={len(audio_labels) + 1}:duration=longest:dropout_transition=0[audio_mixed];[audio_mixed]volume=2.0[audio_out]'
    
    command = [
        'ffmpeg', '-y',  # -y to overwrite output file
        '-i', os.path.join(game.directory, 'silent-goals.mp4'),
        *goal_clips_args,
        '-i', bgm_path,  # Add BGM as input
        '-filter_complex', filter_complex,
        '-map', '0:v',  # Map video from input 0
        '-map', '[audio_out]',  # Map mixed audio
        '-c:v', 'copy',  # Copy video codec
        '-c:a', 'aac',  # Encode audio as AAC
        '-shortest',  # Ensure output duration matches shortest input (video)
        os.path.join(game.directory, 'goals.mp4'),
    ]
    subprocess.run(command, check=True)

    goals_path = os.path.join(game.directory, 'goals.mp4')
    brand_video_path = game.brand_video if os.path.isabs(game.brand_video) else os.path.join(game.directory, game.brand_video)
    brand_video_path = ensure_brand_video(game, brand_video_path)

    branded_goals_path = os.path.join(game.directory, 'goals-branded.mp4')
    join_videos(game, [goals_path, brand_video_path], branded_goals_path, task)
    os.replace(branded_goals_path, goals_path)

    print("done making goals video")
    return goals_path

def join_videos(game, videos, output_file, task=None):
    print(f'Joining videos: {videos} -> {output_file}')
    list_file = os.path.join(game.directory, 'list.txt')
    with open(list_file, 'w') as f:
        for video in videos:
            f.write(f"file '{video}'\n")
    
    cmd = [
        'ffmpeg', '-y',  # -y to overwrite output file
        '-f', 'concat',
        '-safe', '0',
        '-i', list_file,
        '-c', 'copy',
        output_file
    ]
    
    subprocess.run(cmd, cwd=game.directory, check=True)
    
    # Clean up list file
    os.remove(list_file)

    return output_file

def trim_video(game, video, start_time, end_time, output_file, task=None):
    input_path = os.path.join(game.directory, video)
    output_path = os.path.join(game.directory, output_file)
    trim_clip(input_path, start_time, end_time, output_path)
    return output_file

def trim_clip(input_path, start_time, end_time, output_path):
    cmd = [
        'ffmpeg', '-y',  # -y to overwrite output file
        '-i', input_path,
        '-ss', format_ffmpeg_time(start_time),
        '-to', format_ffmpeg_time(end_time),
        '-c', 'copy',  # Copy streams without re-encoding for speed
        output_path
    ]
    
    print(f"Trimming video: {input_path} from {start_time}s to {end_time}s")
    
    subprocess.run(cmd, check=True)


def format_ffmpeg_time(time: float):
    return f'{int(time // 3600)}:{int((time % 3600) // 60)}:{int(time % 60)}'

def get_duration(path: str):
    result = subprocess.run(
        [
            "ffprobe",
            "-v", "error",
            "-show_entries", "format=duration",
            "-of", "default=noprint_wrappers=1:nokey=1",
            path
        ],
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True
    )
    return float(result.stdout.strip())


def get_video_props(file):
    cap = cv2.VideoCapture(file)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
    codec = decode_fourcc(cap.get(cv2.CAP_PROP_FOURCC))
    return {
        'fps': fps,
        'frame_count': frame_count,
        'duration': fps > 0 and frame_count / fps or 0,
        'codec': codec,
    }

def decode_fourcc(cc):
    if cc == 0:
        return "unknown"
    return "".join([chr((int(cc) >> 8 * i) & 0xFF) for i in range(4)])
