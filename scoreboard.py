import cv2
import numpy as np
import os
from PIL import Image, ImageFont, ImageDraw
from utils import format_time

DEFAULT_FONT = 'SourceHanSansSC-Medium'


class TextProp:
    def __init__(self, left, top, width, height, color=None, font=None, font_size=None, autofit=None):
        self.left = left
        self.top = top
        self.width = width
        self.height = height
        self.color = color
        self.font = font
        self.font_size = font_size
        self.autofit = autofit

    @classmethod
    def from_dict(cls, obj, default_font=None, default_font_size=None, default_autofit=None):
        if obj is None:
            return None
        return cls(
            obj['left'],
            obj['top'],
            obj['width'],
            obj['height'],
            color=obj.get('color'),
            font=obj.get('font', default_font),
            font_size=obj.get('font_size', default_font_size),
            autofit=obj.get('autofit', default_autofit),
        )

class Scoreboard:
    def __init__(self, img: str, texts: dict, textprops: dict):
        self.img = img
        self.texts = texts
        self.textprops = textprops
        self.scoreboard_img = cv2.imread(img, cv2.IMREAD_UNCHANGED)
        self.current_scoreboard_img = None
        self.current_scoreboard_key = None
        self.position = None

    def create_scoreboard_img(self, time_str, score0, score1):
        # 创建一个图，在scoreboard_img加上时间和比分
        # 复制scoreboard底图
        if self.scoreboard_img is None:
            return None
        img = self.scoreboard_img.copy()
        # 转换为PIL图像以便绘制文字
        if img.shape[2] == 4:
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGRA2RGBA))
        else:
            pil_img = Image.fromarray(cv2.cvtColor(img, cv2.COLOR_BGR2RGB))

        draw = ImageDraw.Draw(pil_img)

        # 绘制时间
        if 'time' in self.textprops:
            time_prop = self.textprops['time']
            draw_text(draw, time_str, time_prop)

        # 绘制比分0
        if 'score0' in self.textprops:
            score0_prop = self.textprops['score0']
            draw_text(draw, str(score0), score0_prop)

        # 绘制比分1
        if 'score1' in self.textprops:
            score1_prop = self.textprops['score1']
            draw_text(draw, str(score1), score1_prop)

        if 'team0' in self.textprops:
            team0_prop = self.textprops['team0']
            draw_text(draw, self.texts['team0'], team0_prop)

        if 'team1' in self.textprops:
            team1_prop = self.textprops['team1']
            draw_text(draw, self.texts['team1'], team1_prop)

        if 'segment' in self.textprops:
            segment_prop = self.textprops['segment']
            draw_text(draw, self.texts['segment'], segment_prop)

        # 转回OpenCV格式以便cv2使用
        if img.shape[2] == 4:
            result_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGBA2BGRA)
        else:
            result_img = cv2.cvtColor(np.array(pil_img), cv2.COLOR_RGB2BGR)
        return result_img


    @classmethod
    def from_dict(cls, texts, obj):
        textprops = {}
        img = 'scoreboard.png'
        position = None
        default_font = None
        default_font_size = None
        default_autofit = None
        for key, value in obj.items():
            if key == 'img':
                img = value
            elif key == 'position':
                position = value
            elif key == 'font':
                default_font = value
            elif key == 'font_size':
                default_font_size = value
            elif key == 'autofit':
                default_autofit = value
            else:
                textprops[key] = TextProp.from_dict(
                    value,
                    default_font=default_font,
                    default_font_size=default_font_size,
                    default_autofit=default_autofit,
                )

        scoreboard = cls(img, texts, textprops)
        scoreboard.position = position
        return scoreboard


    def render_frame(self, frame, time, score0, score1):
        time_str = format_time(time, 0)
        if self.scoreboard_img is None:
            return frame
        self.update_scoreboard_img(time_str, score0, score1)
        current_img = self.current_scoreboard_img
        if current_img is None:
            return frame
        sh, sw = current_img.shape[:2]
        # If scoreboard image has alpha, blend it onto the frame
        fh, fw = frame.shape[:2]

        # Place scoreboard based on configuration (default: top center)
        x_offset = (fw - sw) // 2
        y_offset = 0
        if self.position:
            align = self.position.get('align', 'top_center') if isinstance(self.position, dict) else 'top_center'
            offset_x = int(self.position.get('offset_x', 0)) if isinstance(self.position, dict) else 0
            offset_y = int(self.position.get('offset_y', 0)) if isinstance(self.position, dict) else 0

            if align in ('top_left', 'left_top'):
                x_offset = 0
                y_offset = 0
            elif align in ('top_right', 'right_top'):
                x_offset = fw - sw
                y_offset = 0
            elif align in ('center', 'center_center'):
                x_offset = (fw - sw) // 2
                y_offset = (fh - sh) // 2
            elif align in ('bottom_left', 'left_bottom'):
                x_offset = 0
                y_offset = fh - sh
            elif align in ('bottom_right', 'right_bottom'):
                x_offset = fw - sw
                y_offset = fh - sh
            elif align in ('bottom_center', 'center_bottom'):
                x_offset = (fw - sw) // 2
                y_offset = fh - sh
            else:
                # Default to top_center
                x_offset = (fw - sw) // 2
                y_offset = 0

            x_offset += offset_x
            y_offset += offset_y
        sh, sw = current_img.shape[:2]
        if current_img.shape[2] == 4:
            alpha_s = current_img[:, :, 3] / 255.0
            alpha_l = 1.0 - alpha_s
            for c in range(0, 3):
                frame[y_offset:y_offset+sh, x_offset:x_offset+sw, c] = (
                    alpha_s * current_img[:, :, c] +
                    alpha_l * frame[y_offset:y_offset+sh, x_offset:x_offset+sw, c]
                )
        else:
            frame[y_offset:y_offset+sh, x_offset:x_offset+sw] = current_img
        return frame

    def update_scoreboard_img(self, time_str, score0, score1):
        key = f'{time_str}_{score0}_{score1}'
        if key == self.current_scoreboard_key:
            return
        self.current_scoreboard_img = self.create_scoreboard_img(time_str, score0, score1)
        self.current_scoreboard_key = key

# Draw texts (score0, score1, and others)
def draw_text(draw, text, textprop):
    if textprop is None:
        return

    color = (255, 255, 255)  # default white
    if textprop.color:
        # Try to parse color string (e.g., "#RRGGBB" or "red")
        try:
            if textprop.color.startswith("#"):
                color = tuple(int(textprop.color[i:i+2], 16) for i in (1, 3, 5))
        except Exception:
            pass

    x, y = int(textprop.left), int(textprop.top)
    width, height = int(textprop.width), int(textprop.height)
    font_size = textprop.font_size or height
    font_name = textprop.font or DEFAULT_FONT
    font_path = os.path.join(os.path.dirname(__file__), "fonts", f"{font_name}.otf")
    autofit = bool(textprop.autofit)

    if autofit and width > 0 and height > 0:
        font_size = fit_font_size(draw, str(text), font_path, width, height, font_size)

    font = ImageFont.truetype(font_path, font_size)
    if autofit and width > 0 and height > 0:
        bbox = draw.textbbox((0, 0), str(text), font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        x_center = x + (width - text_w) // 2 - bbox[0]
        y_center = y + (height - text_h) // 2 - bbox[1]
        draw.text((x_center, y_center), str(text), font=font, fill=(color[0], color[1], color[2], 255))
        return

    draw.text((x, y), str(text), font=font, fill=(color[0], color[1], color[2], 255))


def fit_font_size(draw, text, font_path, max_width, max_height, max_size):
    low = 6
    high = max(6, int(max_size))
    best = low
    while low <= high:
        mid = (low + high) // 2
        font = ImageFont.truetype(font_path, mid)
        bbox = draw.textbbox((0, 0), text, font=font)
        text_w = bbox[2] - bbox[0]
        text_h = bbox[3] - bbox[1]
        if text_w <= max_width and text_h <= max_height:
            best = mid
            low = mid + 1
        else:
            high = mid - 1
    return best


if __name__ == '__main__':
    b = Scoreboard.from_dict(
        {
            'title': 'Soccer Match',
            'team0': '银杏',
            'team1': '樱花',
            'segment': '第1节',
        },
        {
        'img': '../soccer-demo/scoreboard.png',
        'segment': {
            'left': 170,
            'top': 70,
            'width': 30,
            'height': 10,
        },
        'score0': {
            'left': 12,
            'top': 32,
            'width': 20,
            'height': 20,
        },
        'score1': {
            'left': 327,
            'top': 32,
            'width': 18,
            'height': 18,
        },
        'team0': {
            'left': 50,
            'top': 30,
            'width': 70,
            'height': 25,
        },
        'team1': {
            'left': 230,
            'top': 30,
            'width': 70,
            'height': 25,
        },
        'time': {
            'left': 145,
            'top': 30,
            'width': 65,
            'height': 20,
        },
    })

    img = b.update_scoreboard_img("01:00", 10, 0)
    cv2.imshow("img", img)
    cv2.waitKey(0)
    cv2.destroyAllWindows()
