import type { NextConfig } from "next";

const config: NextConfig = {
  // 결과 영상 이어 붙이기(/api/result, lib/stitch.ts)에 필요한 파일을 서버 함수에 함께 올린다:
  // ffmpeg 바이너리(Vercel에는 ffmpeg이 없다)와 원본 전체 영상(<id>.mp4). 생성용 영상(<id>-gen.mp4)과 그림은 싣지 않는다.
  outputFileTracingIncludes: {
    "/api/result": ["./node_modules/ffmpeg-static/ffmpeg", "./public/videos/*-[0-9].mp4"],
  },
  outputFileTracingExcludes: {
    "/api/result": ["./public/videos/*-gen.mp4", "./public/videos/*.jpg", "./public/mediapipe/**", "./public/fonts/**", "./public/models/**"],
  },
};

export default config;
