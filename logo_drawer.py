import cv2

LOGO_FLY = 0.8

class LogoDrawer:
    def __init__(self, logo_video_path, logo_times):
        self.load_logo_video(logo_video_path)
        self.logo_times = logo_times.copy()

    def load_logo_video(self, logo_video_path):
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


    def draw_logo(self, time, frame):
        first_logo_time = len(self.logo_times) > 0 and (self.logo_times[0] - self.logo_video["duration"] / 2) or None

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
