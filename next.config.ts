import type { NextConfig } from "next";

const config: NextConfig = {
  // 결과 영상 이어 붙이기(lib/stitch.ts)에 쓰는 ffmpeg 바이너리를 서버 함수에 함께 올린다. Vercel에는 ffmpeg이 없다.
  outputFileTracingIncludes: {
    "/api/result": ["./node_modules/ffmpeg-static/ffmpeg"],
  },
  // 영상 파일은 서버 함수에 싣지 않는다 (원본은 배포 주소에서 받아 온다)
  outputFileTracingExcludes: {
    "/api/result": ["./public/**"],
  },
};

export default config;
