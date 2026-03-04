import cv2
import numpy as np
import math

DEFAULT_WIPE_DURATION = 1.0
DEFAULT_BLINDS_COUNT = 12
CHEVRON_ANGLE_DEG = 120.0


class ReplayWipeDrawer:
    def __init__(self, replay_wipe_image_path, replay_wipe_times, wipe_effect="left", wipe_duration=DEFAULT_WIPE_DURATION, blinds_count=DEFAULT_BLINDS_COUNT, wipe_direction="down", wipe_zoom=1.05):
        self.replay_wipe_times = replay_wipe_times.copy() if replay_wipe_times else []
        self.wipe_effect = wipe_effect or "left"
        self.wipe_duration = wipe_duration
        self.blinds_count = max(1, int(blinds_count))
        self.wipe_direction = wipe_direction or "down"
        self.wipe_zoom = max(1.0, float(wipe_zoom))
        self._source_image = self.load_replay_wipe_image(replay_wipe_image_path)
        self._cached_size = None
        self._image = None
        self._image_alpha = None
        self._x_norm = None
        self._y_norm = None
        self._dist_norm = None

    def load_replay_wipe_image(self, replay_wipe_image_path):
        image = cv2.imread(replay_wipe_image_path, cv2.IMREAD_UNCHANGED)
        if image is not None:
            print(f"loading replay wipe image {replay_wipe_image_path}")
            return image
        raise RuntimeError(f"Failed to load replay wipe image: {replay_wipe_image_path}")

    def _ensure_cache(self, width, height, zoom):
        cache_key = (width, height, round(zoom, 4))
        if self._cached_size == cache_key:
            return
        self._cached_size = cache_key

        base = cv2.resize(self._source_image, (width, height))
        if zoom > 1.0:
            zoomed = self._scale_and_crop(base, zoom)
        else:
            zoomed = base

        resized = zoomed
        if len(resized.shape) == 2:
            resized = cv2.cvtColor(resized, cv2.COLOR_GRAY2BGR)
        if resized.shape[2] == 4:
            self._image = resized[:, :, :3]
            self._image_alpha = resized[:, :, 3].astype(np.float32) / 255.0
        else:
            self._image = resized
            self._image_alpha = np.ones((height, width), dtype=np.float32)

        x = np.linspace(0.0, 1.0, width, endpoint=False, dtype=np.float32)[None, :]
        y = np.linspace(0.0, 1.0, height, endpoint=False, dtype=np.float32)[:, None]
        self._x_norm = x
        self._y_norm = y
        max_radius = np.sqrt(0.5 * 0.5 + 0.5 * 0.5)
        self._dist_norm = np.sqrt((x - 0.5) ** 2 + (y - 0.5) ** 2) / max_radius

    def _scale_and_crop(self, image, zoom):
        height, width = image.shape[:2]
        zoom_width = max(1, int(round(width * zoom)))
        zoom_height = max(1, int(round(height * zoom)))
        scaled = cv2.resize(image, (zoom_width, zoom_height))
        x0 = max(0, (zoom_width - width) // 2)
        y0 = max(0, (zoom_height - height) // 2)
        return scaled[y0:y0 + height, x0:x0 + width]

    def _wipe_mask(self, progress, entering=True):
        if self._x_norm is None or self._y_norm is None or self._dist_norm is None:
            return 0.0
        effect = (self.wipe_effect or "left").lower()
        if effect == "top":
            return (self._y_norm <= progress).astype(np.float32)
        if effect == "radial":
            return (self._dist_norm <= progress).astype(np.float32)
        if effect == "right":
            return (self._x_norm >= 1.0 - progress).astype(np.float32)
        if effect == "blinds":
            stripe_index = np.floor(self._x_norm * self.blinds_count)
            stripe_start = stripe_index / self.blinds_count
            stripe_progress = (progress - stripe_start) * self.blinds_count
            return np.clip(stripe_progress, 0.0, 1.0).astype(np.float32)
        if effect == "chevron":
            direction = (self.wipe_direction or "down").lower()
            if direction == "up":
                u = 1.0 - self._y_norm
                v = self._x_norm
            elif direction == "right":
                u = self._x_norm
                v = self._y_norm
            elif direction == "left":
                u = 1.0 - self._x_norm
                v = self._y_norm
            else:
                u = self._y_norm
                v = self._x_norm

            v_shape = 1.0 - 2.0 * np.abs(v - 0.5)
            slope = math.tan(math.radians((180.0 - CHEVRON_ANGLE_DEG) / 2.0))
            chevron_height = 0.5 * slope
            edge = np.clip(progress + v_shape * chevron_height, 0.0, 1.0)
            if entering:
                return (u <= edge).astype(np.float32)
            return (u >= edge).astype(np.float32)
        return (self._x_norm <= progress).astype(np.float32)

    def draw_replay_wipe(self, time, frame):
        if not self.replay_wipe_times:
            return

        progress = 0.0
        first_wipe_time = self.replay_wipe_times[0] - self.wipe_duration / 2
        if time > first_wipe_time + self.wipe_duration:
            self.replay_wipe_times.pop(0)
            return

        if time < first_wipe_time:
            return

        progress = (time - first_wipe_time) / self.wipe_duration
        progress = max(0.0, min(1.0, progress))
        zoom = 1.0 + (self.wipe_zoom - 1.0) * progress
        self._ensure_cache(frame.shape[1], frame.shape[0], zoom)
        effect = (self.wipe_effect or "left").lower()
        if effect == "chevron":
            entering = progress <= 0.5
            if entering:
                phase = progress / 0.5
            else:
                phase = (progress - 0.5) / 0.5
        else:
            entering = True
            if progress <= 0.5:
                phase = progress / 0.5
            else:
                phase = (1.0 - progress) / 0.5

        if self._image is None or self._image_alpha is None:
            return

        mask = self._wipe_mask(max(0.0, min(1.0, phase)), entering=entering)
        alpha = mask * self._image_alpha
        alpha_3 = alpha[:, :, None]
        blended = frame.astype(np.float32) * (1.0 - alpha_3) + self._image.astype(np.float32) * alpha_3
        frame[:] = blended.astype(np.uint8)
