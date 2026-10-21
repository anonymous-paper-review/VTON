import "server-only";
import { fal } from "@fal-ai/client";
import { ENGINES, type EngineKey } from "@/lib/engines";

// fal 인증: FAL_KEY 환경변수가 있으면 쓰고, 없으면 네트워크 시크릿(프록시가 Authorization 헤더를 넣는 환경)을 믿고 그대로 호출한다.
if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });

// VTON_MOCK=1: fal을 부르지 않고 몇 초 뒤 원본 영상을 결과로 돌려준다 (화면 흐름 테스트용).
const MOCK = process.env.VTON_MOCK === "1";
const MOCK_SECONDS = 6;

export type JobStatus =
  | { state: "queued"; position?: number }
  | { state: "running" }
  | { state: "done"; videoUrl: string }
  | { state: "failed"; error: string };

/** 클라이언트에 넘기는 job id: 엔진과 fal request id를 묶어 상태 조회 때 엔드포인트를 알 수 있게 한다. */
const encodeId = (engine: EngineKey, requestId: string) => `${engine}.${requestId}`;
function decodeId(id: string): { engine: EngineKey; requestId: string } | null {
  const dot = id.indexOf(".");
  const engine = id.slice(0, dot) as EngineKey;
  return dot > 0 && engine in ENGINES ? { engine, requestId: id.slice(dot + 1) } : null;
}

export async function submitJob(opts: {
  engine: EngineKey;
  videoUrl: string;
  target: string;
  selfie: File;
}): Promise<string> {
  if (MOCK) {
    const payload = Buffer.from(JSON.stringify({ at: Date.now(), video: opts.videoUrl })).toString("base64url");
    return `mock.${payload}`;
  }
  // 셀카는 클라이언트에서 1280px JPEG로 줄여 오므로 data URI로 바로 넣는다 (실험에서 Kling·Wan이 받는 것을 확인).
  // fal 스토리지 업로드를 거치지 않아 사진이 별도 저장소에 남지 않는다.
  const faceUrl = `data:${opts.selfie.type};base64,${Buffer.from(await opts.selfie.arrayBuffer()).toString("base64")}`;
  const engine = ENGINES[opts.engine];
  const { request_id } = await fal.queue.submit(engine.endpoint, {
    input: engine.build({ videoUrl: opts.videoUrl, faceUrl, target: opts.target }),
  });
  return encodeId(opts.engine, request_id);
}

export async function jobStatus(id: string): Promise<JobStatus> {
  if (id.startsWith("mock.")) {
    const { at, video } = JSON.parse(Buffer.from(id.slice(5), "base64url").toString());
    const elapsed = (Date.now() - at) / 1000;
    if (elapsed < 2) return { state: "queued", position: 1 };
    if (elapsed < MOCK_SECONDS) return { state: "running" };
    return { state: "done", videoUrl: video };
  }
  const parsed = decodeId(id);
  if (!parsed) return { state: "failed", error: "잘못된 작업 번호예요." };
  const { endpoint } = ENGINES[parsed.engine];

  const status = await fal.queue.status(endpoint, { requestId: parsed.requestId, logs: false });
  if (status.status === "IN_QUEUE") return { state: "queued", position: status.queue_position };
  if (status.status === "IN_PROGRESS") return { state: "running" };
  try {
    const result = await fal.queue.result(endpoint, { requestId: parsed.requestId });
    const url = (result.data as { video?: { url?: string } })?.video?.url;
    return url ? { state: "done", videoUrl: url } : { state: "failed", error: "결과 영상이 없어요." };
  } catch (e) {
    return { state: "failed", error: describeFalError(e) };
  }
}

export function describeFalError(e: unknown): string {
  const body = JSON.stringify((e as { body?: unknown })?.body ?? "");
  if (/safety|content/i.test(body)) return "안전 필터에 걸렸어요. 얼굴이 잘 보이는 사진으로 다시 찍어 주세요.";
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403) return "서버 설정 문제로 지금은 만들 수 없어요.";
  return "영상을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.";
}
