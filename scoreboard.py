import cv2
import numpy as np
import os
from moviepy import ImageClip, TextClip, CompositeVideoClip
from utils import format_time

DEFAULT_FONT = 'SourceHanSansSC-Medium'


class TextProp:
    def __init__(self, left, top, width, height, color=None, font=None):
        self.left = left
        self.top = top
        self.width = width
        self.height = height
        self.color = color
        self.font = font
    @classmethod
    def from_dict(cls, obj):
        return cls(obj['left'], obj['top'], obj['width'], obj['height'], color=obj.get('color'), font=obj.get('font')) if obj is not None else None

class Scoreboard:
    def __init__(self, img: str, texts: dict, textprops: dict):
        self.img = img
        self.texts = texts
        self.textprops = textprops
        self.scoreboard_img = cv2.imread(img, cv2.IMREAD_UNCHANGED)


    @classmethod
    def from_dict(cls, texts, obj):
        textprops = {}
        img = 'scoreboard.png'
        for key, value in obj.items():
            if key == 'img':
                img = value
            else:
                textprops[key] = TextProp.from_dict(value)

        return cls(img, texts, textprops)


    def render_frame(self, frame, time, score0, score1):
        # If scoreboard image has alpha, blend it onto the frame
        sh, sw = self.scoreboard_img.shape[:2]
        fh, fw = frame.shape[:2]

        # Place scoreboard at the top center
        x_offset = (fw - sw) // 2
        y_offset = 0

        # Prepare overlay
        overlay = frame
        # If scoreboard has alpha channel, blend it
        if self.scoreboard_img.shape[2] == 4:
            alpha_s = self.scoreboard_img[:, :, 3] / 255.0
            alpha_l = 1.0 - alpha_s
            for c in range(0, 3):
                overlay[y_offset:y_offset+sh, x_offset:x_offset+sw, c] = (
                    alpha_s * self.scoreboard_img[:, :, c] +
                    alpha_l * overlay[y_offset:y_offset+sh, x_offset:x_offset+sw, c]
                )
        else:
            overlay[y_offset:y_offset+sh, x_offset:x_offset+sw] = self.scoreboard_img

        # Draw scores
        overlay = draw_text(overlay, score0, self.textprops.get('score0'))
        overlay = draw_text(overlay, score1, self.textprops.get('score1'))

        # Draw other texts
        for key, text in self.texts.items():
            if key in ['score0', 'score1']:
                continue
            textprop = self.textprops.get(key)
            overlay = draw_text(overlay, text, textprop)

        # Draw time if needed
        time_textprop = self.textprops.get('time')
        if time_textprop is not None:
            overlay = draw_text(overlay, format_time(time, 0), time_textprop)

        return overlay

# Draw texts (score0, score1, and others)
def draw_text(img, text, textprop):
    if textprop is None:
        return

    color = (255, 255, 255)  # default white
    if textprop.color:
        # Try to parse color string (e.g., "#RRGGBB" or "red")
        try:
            if textprop.color.startswith("#"):
                color = tuple(int(textprop.color[i:i+2], 16) for i in (1, 3, 5))[::-1]
        except Exception:
            pass

    x, y = int(textprop.left + x_offset), int(textprop.top + y_offset + textprop.height)
    fontpath = "./simsun.ttc"
    font = ImageFont.truetype(fontpath, 32)
    img_pil = Image.fromarray(img)
    draw = ImageDraw.Draw(img_pil)
    draw.text((50, 80),  text, font = font, fill = (color[0], color[1], color[2], 255))
    img = np.array(img_pil)

    return img


if __name__ == '__main__':
    b = Scoreboard.from_dict(
        {
            'title': 'Soccer Match',
            'team0': '银杏',
            'team1': '樱花',
            'quarter': '第2节',
        },
        {
        'img': '../soccer-demo/scoreboard.png',
        'quarter': {
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

    b.render(60, 10, 0, 0).preview()