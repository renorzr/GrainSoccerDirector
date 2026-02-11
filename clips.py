import cv2
import os
import subprocess
from event import EventType
from utils import format_time
from logo_drawer import LogoDrawer
import glob
from constants import REPLAY_BUFFER


def make_final_video(game, task=None):
    # Create a list of video files to concatenate
    video_files = []
    
    # Add brand video
    brand_video_path = game.brand_video if os.path.isabs(game.brand_video) else os.path.join(game.directory, game.brand_video)
    
    # Add segment videos with brand video between each
    for segment in range(1, len(game.videos) + 1):
        segment_path = os.path.join(game.directory, f'output-{segment}.mp4')
        if not os.path.exists(segment_path):
            raise FileNotFoundError(f'output-{segment}.mp4 not found')
        video_files.append(segment_path)

    # video_files.append(brand_video_path)
    
    # Get fps from first video to use as target fps
    first_video_props = get_video_props(video_files[0])
    target_fps = first_video_props['fps']
    print(f"Target FPS for final video: {target_fps}")
    
    # Build ffmpeg command with concat filter to unify fps
    output_file = os.path.join(game.directory, f'final-{game.game_id}.mp4')
    
    # Build input arguments
    input_args = []
    for video_file in video_files:
        input_args.extend(['-i', video_file])
    
    # Build filter_complex to unify fps and concatenate
    # Format: [0:v]fps=target_fps[v0];[0:a]asetpts=PTS-STARTPTS[a0];[1:v]fps=target_fps[v1];[1:a]asetpts=PTS-STARTPTS[a1];...[v0][a0][v1][a1]...concat=n=N:v=1:a=1[outv][outa]
    filter_parts = []
    video_labels = []
    audio_labels = []
    
    for i in range(len(video_files)):
        # Normalize video fps
        video_labels.append(f'v{i}')
        filter_parts.append(f'[{i}:v]fps={target_fps}[{video_labels[i]}]')
        # Normalize audio timestamps
        # Note: This assumes all videos have audio streams. If some don't, 
        # ffmpeg will fail and you may need to add audio stream detection.
        audio_labels.append(f'a{i}')
        filter_parts.append(f'[{i}:a]asetpts=PTS-STARTPTS[{audio_labels[i]}]')
    
    # Concatenate all streams
    concat_inputs = ''.join([f'[{label}]' for label in video_labels + audio_labels])
    filter_complex = ';'.join(filter_parts) + f';{concat_inputs}concat=n={len(video_files)}:v=1:a=1[outv][outa]'
    
    cmd = [
        'ffmpeg', '-y',  # -y to overwrite output file
        *input_args,
        '-filter_complex', filter_complex,
        '-map', '[outv]',  # Map concatenated video
        '-map', '[outa]',  # Map concatenated audio
        '-c:v', 'libx264',  # Re-encode video with H.264
        '-preset', 'fast',  # Fast encoding preset for speed
        '-crf', '23',  # Good quality with reasonable file size
        '-c:a', 'aac',  # Re-encode audio with AAC
        '-b:a', '192k',  # Audio bitrate
        output_file
    ]
    
    print(f"Creating final video: {output_file}")
    print(f"Unifying FPS to {target_fps} for {len(video_files)} videos")
    
    subprocess.run(cmd, check=True)

    make_goals_video(game, task)

def make_goals_video(game, task=None):
    goal_clip_paths = glob.glob(os.path.join(game.directory, 'goal-*.mp4'))
    goal_clip_paths.sort()
    logo_times = [0]
    for goal_clip_path in goal_clip_paths:
        logo_times.append(logo_times[-1] + get_duration(goal_clip_path) + REPLAY_BUFFER * 4)
    logo_video_path = game.logo_video if os.path.isabs(game.logo_video) else os.path.join(game.directory, game.logo_video)
    logo_drawer = LogoDrawer(logo_video_path, logo_times)
    print(f"logo times: {logo_times}")

    out_frame_count = 0
    out = None
    fps = 0
    for index, goal_clip_path in enumerate(goal_clip_paths):
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

            logo_drawer.draw_logo(out_time, frame)
            out.write(frame)

        cap.release()
        print(f"made goals video {index} / {len(goal_clip_paths)} {goal_clip_path}")

    # Release VideoWriter before using the file with ffmpeg
    if out:
        out.release()
        out = None

    print("add audio to goals video")
    logo_times.pop()  # Remove the last element which is the total duration
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
        delay_ms = int(logo_times[i] * 1000)  # Convert seconds to milliseconds
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

    print("done making goals video")
    return os.path.join(game.directory, 'goals.mp4')

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