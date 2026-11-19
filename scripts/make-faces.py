#!/usr/bin/env python3
"""그·그녀 얼굴 사진(public/videos/<장소>-{woman,man}.jpg, 480x560)을 트레일러에서 잘라 만든다.

  python3 scripts/make-faces.py <트레일러 폴더>      (opencv-python 필요)

역할 고르는 화면에 보이고, 그녀 사진은 그를 바꿀 때 "그대로 둘 사람" 참고 사진(still)으로 엔진에도 간다.
그래서 장소마다 그 장면 옷을 입은, 되도록 정면에서 웃는 프레임을 골랐다.
정면으로 웃는 컷이 트레일러에 없는 역할은 가장 가까운 컷이다 (십리벚꽃길 그: 정면 무표정, 섬진강 그: 반측면 미소).
"""
import os, sys
import cv2

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "videos")
TRAILER = {"simni": "cherry_F2a.mp4", "market": "market_D1a.mp4", "tea": "tea_W.mp4", "river": "river_F2b.mp4"}
W, H = 480, 560

# 역할: (프레임 번호(24fps), 얼굴 상자 (x, y, w, h), 얼굴 너비 대비 자르는 너비, 얼굴 상자 안 세로 중심, 선명화)
FACES = {
    "simni-woman": (598, (336, 218, 174, 174), 2.0, 0.50, 0.25),
    "simni-man": (219, (637, 93, 207, 207), 2.0, 0.50, 0),
    "market-woman": (503, (404, 282, 166, 166), 1.9, 0.45, 0.25),
    "market-man": (612, (785, 79, 177, 177), 2.0, 0.50, 0.25),
    "tea-woman": (348, (538, 152, 285, 285), 1.75, 0.40, 0),
    "tea-man": (713, (753, 97, 78, 78), 2.0, 0.50, 0.3),
    "river-woman": (347, (417, 107, 149, 149), 2.0, 0.50, 0.25),
    "river-man": (213, (890, 95, 150, 150), 2.0, 0.50, 0.2),
}


def main(trailers):
    for role, (n, (x, y, w, h), k, dy, sharp) in FACES.items():
        cap = cv2.VideoCapture(os.path.join(trailers, TRAILER[role.split("-")[0]]))
        cap.set(cv2.CAP_PROP_POS_FRAMES, n)
        ok, img = cap.read()
        assert ok, f"{role}: {n}번 프레임을 읽지 못했다"
        cw = w * k
        ch = cw * H / W
        fh, fw = img.shape[:2]
        x0 = int(min(max(x + w / 2 - cw / 2, 0), fw - cw))
        y0 = int(min(max(y + h * dy - ch / 2, 0), fh - ch))
        out = cv2.resize(img[y0:y0 + int(ch), x0:x0 + int(cw)], (W, H), interpolation=cv2.INTER_LANCZOS4 if cw < W else cv2.INTER_AREA)
        if sharp:  # 작게 찍힌 얼굴은 키우면서 흐려져 조금 선명하게 한다
            out = cv2.addWeighted(out, 1 + sharp, cv2.GaussianBlur(out, (0, 0), 1.6), -sharp, 0)
        cv2.imwrite(os.path.join(OUT, f"{role}.jpg"), out, [cv2.IMWRITE_JPEG_QUALITY, 88])
        print(f"{role:13s} 프레임 {n}  원본 {int(cw)}x{int(ch)}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
