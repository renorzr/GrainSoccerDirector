import argparse
import os
import yaml
from scoreboard import Scoreboard


def main():
    parser = argparse.ArgumentParser(description="Render scoreboard preview image")
    parser.add_argument("scoreboard", type=str, help="Path to scoreboard.yaml")
    parser.add_argument("--team0", type=str, default="银杏")
    parser.add_argument("--team1", type=str, default="木荷")
    parser.add_argument("--score0", type=int, default=2)
    parser.add_argument("--score1", type=int, default=0)
    parser.add_argument("--time", type=str, default="30:51")
    parser.add_argument("--segment", type=str, default="第1节")
    parser.add_argument("--out", type=str, default="resources/scoreboard_preview.png")
    args = parser.parse_args()

    with open(args.scoreboard, "r", encoding="utf-8") as f:
        config = yaml.safe_load(f)

    texts = {
        "title": "Scoreboard Preview",
        "team0": args.team0,
        "team1": args.team1,
        "segment": args.segment,
    }

    scoreboard = Scoreboard.from_dict(texts, config)
    scoreboard.update_scoreboard_img(args.time, args.score0, args.score1)
    if scoreboard.current_scoreboard_img is None:
        raise RuntimeError("Failed to render scoreboard preview")

    out_path = args.out
    out_dir = os.path.dirname(out_path)
    if out_dir:
        os.makedirs(out_dir, exist_ok=True)
    import cv2
    cv2.imwrite(out_path, scoreboard.current_scoreboard_img)
    print(out_path)


if __name__ == "__main__":
    main()
