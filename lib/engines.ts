// fal 교체 엔진 정의. 호출 형식은 faceswap-studio.html에서 동작 확인된 것을 따른다.
// 기본 엔진은 VTON_ENGINE 환경변수로 바꾼다. 엔진 비교 2차(2026-10-21) 결과 MiniMax H3 Max Recast가 1순위
// (닮음 점수 Kling O3보다 높고 3분 vs 8분, 대신 초당 비용 약 2.5배). Kling O3는 싼 대안으로 둔다.
// 셀카 정면 1장이 캐릭터시트보다 닮음 점수가 오히려 높았다.
// Seedance 2.5 editing은 실존 인물 닮음 정책으로 얼굴 교체 요청을 거부해서(422) 뺐다.
// Wan은 화면에서 가장 큰 인물만 바뀌고 대상을 고를 수 없으며 한 번에 13~18분 걸린다.

export type EngineKey = "minimax-h3" | "kling-o3" | "kling-o1" | "wan";

type BuildArgs = { videoUrl: string; faceUrl: string; target: string };

type Engine = {
  endpoint: string;
  minSeconds: number;
  maxSeconds: number;
  build: (a: BuildArgs) => Record<string, unknown>;
};

const klingPrompt = (videoRef: string, target: string) =>
  `Replace ${target} in ${videoRef} with @Element1. ` +
  "Keep exactly the same body motion, facial expression timing, camera movement, framing, lighting and color grade. " +
  "Do not change the background or any other people in the scene.";

export const ENGINES: Record<EngineKey, Engine> = {
  // 사진 1장이 화면의 주요 인물(여럿이면 왼쪽부터)에 대응한다. 배경은 다시 그려지지만 눈으로는 거의 같다.
  // 실험은 1080P($0.45/초)로 했다. 768P는 $0.30/초.
  "minimax-h3": {
    endpoint: "minimax/h3-max/recast",
    minSeconds: 5,
    maxSeconds: 30,
    build: ({ videoUrl, faceUrl, target }) => ({
      video_url: videoUrl,
      reference_image_urls: [faceUrl],
      resolution: "1080P",
      prompt: `Recast ${target} as the person in the reference photo. Keep everything else unchanged.`,
    }),
  },
  "kling-o3": {
    endpoint: "fal-ai/kling-video/o3/pro/video-to-video/edit",
    minSeconds: 3,
    maxSeconds: 15,
    build: ({ videoUrl, faceUrl, target }) => ({
      video_url: videoUrl,
      prompt: klingPrompt("@Video1", target),
      keep_audio: true,
      elements: [{ frontal_image_url: faceUrl, reference_image_urls: [faceUrl] }],
    }),
  },
  "kling-o1": {
    endpoint: "fal-ai/kling-video/o1/video-to-video/edit",
    minSeconds: 3,
    maxSeconds: 10,
    build: ({ videoUrl, faceUrl, target }) => ({
      video_url: videoUrl,
      prompt: klingPrompt("the video", target),
      keep_audio: true,
      elements: [{ frontal_image_url: faceUrl, reference_image_urls: [faceUrl] }],
    }),
  },
  wan: {
    endpoint: "fal-ai/wan/v2.2-14b/animate/replace",
    minSeconds: 1,
    maxSeconds: 30,
    build: ({ videoUrl, faceUrl }) => ({
      video_url: videoUrl,
      image_url: faceUrl,
      resolution: "720p",
      num_inference_steps: 20,
      use_turbo: false,
      video_quality: "high",
    }),
  },
};

export function engineKey(raw = process.env.VTON_ENGINE): EngineKey {
  return raw && raw in ENGINES ? (raw as EngineKey) : "minimax-h3";
}
