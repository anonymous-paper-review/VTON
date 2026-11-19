#!/usr/bin/env python3
"""하동 트레일러 4편에서 샘플 클립 10개를 만든다.

  python3 scripts/make-clips.py <트레일러 폴더>

클립마다 세 가지를 만든다 (public/videos/):
  <id>.mp4      전체 영상: 얼굴 샷(G) + 얼굴 없는 샷(N). 목록·미리보기에 보이는 영상
  <id>-gen.mp4  생성용: 얼굴 샷(G)만 이어 붙인 영상. H3 Max에는 이것만 보낸다 (요금이 길이에 비례)
  <id>.jpg      목록 그림
그리고 data/videos.json의 seconds·gen·parts를 맞춰 고친다 (제목·등장인물은 그대로 둔다).
결과가 오면 서버가 parts 순서대로 "생성 결과의 G 구간 + 전체 영상의 N 구간"을 이어 붙인다 (lib/stitch.ts).

끝맺음: 마지막 샷이 검정으로 디졸브되고(FADE 프레임), 검정 바탕에 트레일러 끝 타이틀
("장소 이름 / 화개(花開), 장날에 만나요", scripts/titles/<장소>.png)이 떠오른다(TAIL 프레임).
타이틀은 전체 영상에만 들어가는 원본 구간이라 엔진에 보내는 길이(요금)는 그대로다.

숫자는 트레일러의 프레임 번호(24fps)다. 컷 경계에서 한 프레임씩 안쪽으로 잡았다.
H3 Max는 5초 미만 영상을 받지 않으므로 G 합계는 5.4초(130프레임) 이상으로 둔다.
"""
import json, os, subprocess, sys

FPS = 24
MIN_GEN_FRAMES = 130
FADE = 12       # 마지막 샷이 검정으로 사라지는 길이 (0.5초)
TAIL = 48       # 검정 바탕 타이틀 길이 (2초)
TITLE_IN = 10   # 타이틀이 떠오르는 길이
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "videos")
TRAILER = {"simni": "cherry_F2a.mp4", "market": "market_D1a.mp4", "tea": "tea_W.mp4", "river": "river_F2b.mp4"}

# id: (목록 그림 프레임, [(종류, 시작 프레임, 끝 프레임(미포함)), ...] 재생 순서)
CLIPS = {
    "simni-1": (350, [("N", 2, 48), ("G", 182, 240), ("G", 302, 409)]),      # 항공 전경 + 그 클로즈업 + 그녀 클로즈업
    "simni-2": (570, [("G", 411, 469), ("N", 471, 517), ("G", 519, 625)]),   # 그 옆얼굴 + 꽃잎 건네는 손 + 마주 선 두 사람
    "market-1": (205, [("N", 12, 71), ("G", 169, 239), ("G", 286, 356)]),    # 장터 전경 + 먹여 주기 + 인파 속 두 사람
    "market-2": (262, [("G", 73, 119), ("N", 121, 167), ("G", 241, 284), ("G", 378, 426)]),  # 걷는 두 사람 + 따르는 손 + 그녀 한입 + 그녀 반응
    "market-3": (540, [("N", 12, 71), ("G", 426, 488), ("G", 490, 640)]),    # 장터 전경 + 그녀 반응 + 나란히 선 두 사람 (자막이 얹히기 전까지 전부)
    "tea-1": (218, [("N", 2, 60), ("G", 183, 254), ("G", 256, 363)]),        # 차밭 전경 + 차 건네는 그 + 차 마시는 그녀
    "tea-2": (580, [("N", 135, 181), ("G", 437, 531), ("G", 533, 628)]),     # 찻잎 따는 손 + 그 클로즈업 + 그녀 클로즈업
    "river-1": (126, [("G", 97, 155), ("G", 157, 215), ("N", 217, 251), ("G", 253, 307)]),   # 웃는 그녀 + 손 내미는 그 + 맞잡는 손 + 달리는 두 사람
    "river-2": (355, [("N", 2, 47), ("G", 309, 400), ("G", 402, 444)]),      # 섬진강 전경 + 물가의 그녀 + 웃는 그
    "river-3": (600, [("G", 444, 495), ("N", 497, 556), ("G", 558, 640)]),   # 웃는 그 + 재첩과 발 + 쪼그려 앉은 두 사람
}


def join(src, out, segs, title=None):
    """프레임 구간들을 이어 붙인다. 소리는 첫 구간 시작부터 끊김 없이 이어서 쓴다(음악이 컷마다 튀지 않게).
    title(그림 파일)을 주면 마지막 구간을 검정으로 디졸브하고 타이틀을 붙인다."""
    n = sum(b - a for a, b in segs) + (TAIL if title else 0)
    tot = n / FPS
    a0 = segs[0][0] / FPS
    chains = []
    for i, (a, b) in enumerate(segs):
        fade = f",fade=t=out:start_frame={b - a - FADE}:nb_frames={FADE}" if title and i == len(segs) - 1 else ""
        chains.append(f"[0:v]trim=start_frame={a}:end_frame={b},setpts=PTS-STARTPTS{fade}[v{i}]")
    labels = "".join(f"[v{i}]" for i in range(len(segs)))
    if title:
        chains.append(f"[1:v]fps={FPS},scale=1344:768,format=yuv420p,fade=t=in:start_frame=0:nb_frames={TITLE_IN},trim=end_frame={TAIL},setpts=PTS-STARTPTS[tail]")
        labels += "[tail]"
    f = ";".join(chains) + ";" + labels + f"concat=n={len(segs) + (1 if title else 0)}:v=1:a=0[v]"
    out_fade = 1.2 if title else 0.6
    f += f";[0:a]atrim={a0}:{a0 + tot},asetpts=PTS-STARTPTS,afade=t=in:d=0.3,afade=t=out:st={tot - out_fade}:d={out_fade}[a]"
    inputs = ["-i", src] + (["-loop", "1", "-framerate", str(FPS), "-t", str(TAIL / FPS + 1), "-i", title] if title else [])
    subprocess.run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", f, "-map", "[v]", "-map", "[a]",
                    "-c:v", "libx264", "-crf", "22", "-preset", "slow", "-pix_fmt", "yuv420p", "-r", str(FPS), "-frames:v", str(n),
                    "-movflags", "+faststart", "-c:a", "aac", "-b:a", "128k", "-t", f"{tot:.4f}", out], check=True)
    return n


def main(trailers):
    path = os.path.join(ROOT, "data", "videos.json")
    videos = json.load(open(path, encoding="utf-8"))
    by_id = {v["id"]: v for v in videos}
    total_cost = 0.0
    for vid, (poster, shots) in CLIPS.items():
        group = vid.split("-")[0]
        src = os.path.join(trailers, TRAILER[group])
        title = os.path.join(ROOT, "scripts", "titles", f"{group}.png")
        full = join(src, os.path.join(OUT, f"{vid}.mp4"), [(a, b) for _, a, b in shots], title)
        gen_shots = [(a, b) for k, a, b in shots if k == "G"]
        gen = join(src, os.path.join(OUT, f"{vid}-gen.mp4"), gen_shots)
        assert gen >= MIN_GEN_FRAMES, f"{vid}: 생성 구간이 너무 짧다 ({gen}프레임)"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", src, "-vf", f"select=eq(n\\,{poster}),scale=1280:732", "-frames:v", "1", "-q:v", "3",
                        os.path.join(OUT, f"{vid}.jpg")], check=True)
        # 이어 붙은 같은 종류는 한 덩어리로 (서버가 덜 자르게)
        parts = []
        for k, a, b in shots:
            kind = "gen" if k == "G" else "orig"
            if parts and parts[-1][0] == kind:
                parts[-1][1] += b - a
            else:
                parts.append([kind, b - a])
        # 마지막 샷 끝을 검정으로 디졸브(세 번째 값)하고, 타이틀은 원본 구간으로 붙인다
        parts[-1].append(FADE)
        parts.append(["orig", TAIL])
        v = by_id[vid]
        v["seconds"] = round(full / FPS)
        v["gen"] = {"src": f"/videos/{vid}-gen.mp4", "seconds": round(gen / FPS, 2)}
        v["parts"] = parts
        # fal 요금 (768P): 출력 $0.085/초 + 입력 토큰. 샷마다 최소 2.5초로 센다 (README 참고)
        cost = 0.085 * max(gen / FPS, 5) + 0.1485 * sum(max((b - a) / FPS, 2.5) for a, b in gen_shots) - 0.09
        total_cost += cost
        print(f"{vid:9s} 전체 {full / FPS:5.2f}s  생성 {gen / FPS:5.2f}s  예상 ${cost:.2f}  {parts}")
    json.dump(videos, open(path, "w", encoding="utf-8"), ensure_ascii=False, indent=2)
    open(path, "a").write("\n")
    print(f"합계 ${total_cost:.2f}, 편당 평균 ${total_cost / len(CLIPS):.2f}")


if __name__ == "__main__":
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    main(sys.argv[1])
