// fal 교체 엔진 정의. 호출 형식은 faceswap-studio.html에서 동작 확인된 것을 따른다.
// 기본 엔진은 VTON_ENGINE 환경변수로 바꾼다 (엔진 비교 실험 결과에 맞춰 고른다).

export type EngineKey = "kling-o3" | "kling-o1" | "wan" | "seedance";

type BuildArgs = { videoUrl: string; faceUrl: string; target: string };

type Engine = {
  endpoint: string;
  maxSeconds: number;
  build: (a: BuildArgs) => Record<string, unknown>;
};

const klingPrompt = (videoRef: string, target: string) =>
  `Replace ${target} in ${videoRef} with @Element1. ` +
  "Keep exactly the same body motion, facial expression timing, camera movement, framing, lighting and color grade. " +
  "Do not change the background or any other people in the scene.";

export const ENGINES: Record<EngineKey, Engine> = {
  "kling-o3": {
    endpoint: "fal-ai/kling-video/o3/pro/video-to-video/edit",
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
  // Seedance 2.5 파라미터는 조사 대화 기준이며 실제 호출로 검증 전이다.
  seedance: {
    endpoint: "bytedance/seedance-2.5/reference-to-video",
    maxSeconds: 30,
    build: ({ videoUrl, faceUrl, target }) => ({
      task: "editing",
      video_urls: [videoUrl],
      image_urls: [faceUrl],
      prompt: `Replace ${target} in @Video1 with the person in @Image1. Keep motion, camera, framing, lighting and background unchanged. Do not change any other people.`,
    }),
  },
};

export function engineKey(raw = process.env.VTON_ENGINE): EngineKey {
  return raw && raw in ENGINES ? (raw as EngineKey) : "kling-o3";
}
