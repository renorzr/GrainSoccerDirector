import cv2
import os
import subprocess
from event import EventType
from utils import format_time



def make_final_video(game, task=None):
    # Create a list of video files to concatenate
    video_files = []
    
    # Add brand video
    brand_video_path = game.brand_video if os.path.isabs(game.brand_video) else os.path.join(game.directory, game.brand_video)
    video_files.append(brand_video_path)
    
    # Add segment videos with brand video between each
    for segment in range(1, len(game.videos) + 1):
        segment_path = os.path.join(game.directory, f'output-{segment}.mp4')
        if not os.path.exists(segment_path):
            raise FileNotFoundError(f'output-{segment}.mp4 not found')
        video_files.append(segment_path)
        video_files.append(brand_video_path)
    
    # Create concat file for ffmpeg
    concat_file = os.path.join(game.directory, 'concat_list.txt')
    with open(concat_file, 'w') as f:
        for video_file in video_files:
            f.write(f"file '{video_file}'\n")
    
    # Use ffmpeg to concatenate videos
    output_file = os.path.join(game.directory, f'final-{game.game_id}.mp4')
    cmd = [
        'ffmpeg', '-y',  # -y to overwrite output file
        '-f', 'concat',
        '-safe', '0',
        '-i', concat_file,
        '-c', 'copy',
        output_file
    ]
    
    if task:
        print(f"Creating final video: {output_file}")
    
    subprocess.run(cmd, check=True)
    
    # Clean up concat file
    os.remove(concat_file)

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