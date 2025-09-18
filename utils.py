import numpy as np
import openai
import os
import csv
import pickle
import cv2

GAME_DATA_DIR = os.getenv("GAME_DATA_DIR", os.path.join(os.path.dirname(os.path.abspath(__file__)), "games"))

# Description: Utility functions for the project

# Description: This function parses a time string in the format 'mm:ss.s' to seconds.
def parse_time(value):
    # if value is already a number, return it
    if (not value) or isinstance(value, (int, float)):
        return value

    try:
        return float(value)
    except:
        pass
    
    (minutes, seconds) = str(value).split(':')
    return int(minutes) * 60 + float(seconds)


def format_time(seconds, decimal_places=1, use_separator=True):
    if seconds is None:
        return None

    minutes = int(seconds // 60)
    seconds = seconds % 60
    
    sep = ':' if use_separator else ''
    if decimal_places == 0:
        return f'{minutes:02d}{sep}{seconds:02.0f}'
    
    dot = '.' if use_separator else ''
    width = decimal_places + 3  # 3 = 2 (整数位) + 1 (小数点)
    return f'{minutes:02d}{sep}{seconds:0{width}.{decimal_places}f}'.replace('.', dot)

def load_game_data(game_id: str, segment: int):
    save_path = game_data_path(game_id, segment)
    with open(save_path, 'rb') as f:
        game_data = pickle.load(f)
    return game_data

def save_game_data(game_id: str, segment: int, game_data: dict):
    save_path = game_data_path(game_id, segment)
    with open(save_path, 'wb') as f:
        pickle.dump(game_data, f)

def game_data_path(game_id: str, segment: int):
    return os.path.join(GAME_DATA_DIR, 'game.' + game_id + '-' + str(segment) + '.pkl')
    
def events_path(game_id: str, segment: int):
    return os.path.join(GAME_DATA_DIR, 'events.' + game_id + '-' + str(segment) + '.csv')

def video_preview(filepath: str, size: tuple[int, int] = (200, 150)):
    if not os.path.exists(filepath):
        return None

    try:
        cap = cv2.VideoCapture(filepath)
        if not cap.isOpened():
            return None
            
        frame_count = cap.get(cv2.CAP_PROP_FRAME_COUNT)
        fps = cap.get(cv2.CAP_PROP_FPS)
        
        if fps <= 0:
            cap.release()
            return None
            
        duration = frame_count / fps
        sample_pos = 5000
        if duration < 5:
            sample_pos = duration * 1000 / 2
        cap.set(cv2.CAP_PROP_POS_MSEC, sample_pos)
        ret, frame = cap.read()
        cap.release()

        if not ret or frame is None:
            return None

        # 保持长宽比例进行缩放
        h, w = frame.shape[:2]
        target_w, target_h = size
        
        # 计算缩放比例，取较小的比例以确保图片完全适应目标尺寸
        scale = min(target_w / w, target_h / h)
        new_w = int(w * scale)
        new_h = int(h * scale)
        
        # 缩放图片
        resized_frame = cv2.resize(frame, (new_w, new_h))
        
        # 创建目标尺寸的黑色背景
        result_frame = np.zeros((target_h, target_w, 3), dtype=np.uint8)
        
        # 计算居中位置
        y_offset = (target_h - new_h) // 2
        x_offset = (target_w - new_w) // 2
        
        # 将缩放后的图片放到黑色背景的中央
        result_frame[y_offset:y_offset+new_h, x_offset:x_offset+new_w] = resized_frame
        
        ret, buf = cv2.imencode('.jpg', result_frame)
        if not ret:
            return None

        return buf.tobytes()
    except Exception as e:
        print(f"Error generating video preview: {e}")
        return None