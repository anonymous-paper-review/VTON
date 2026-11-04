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
  | { state: "failed"; code: string };

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
  /** 바꿀 인물보다 왼쪽에 있어 그대로 둘 인물들 (원본 얼굴 사진) */
  keep: { target: string; imageUrl: string }[];
  selfie: File;
}): Promise<string> {
  if (MOCK) {
    const payload = Buffer.from(JSON.stringify({ at: Date.now(), video: opts.videoUrl })).toString("base64url");
    return `mock.${payload}`;
  }
  // 셀카는 클라이언트에서 1280px JPEG로 줄여 오므로 data URI로 바로 넣는다 (실험에서 Kling·Wan·MiniMax가 받는 것을 확인).
  // fal 스토리지 업로드를 거치지 않아 사진이 별도 저장소에 남지 않는다.
  const faceUrl = `data:${opts.selfie.type};base64,${Buffer.from(await opts.selfie.arrayBuffer()).toString("base64")}`;
  const engine = ENGINES[opts.engine];
  const { request_id } = await fal.queue.submit(engine.endpoint, {
    input: engine.build({
      videoUrl: opts.videoUrl,
      faceUrl,
      target: opts.target,
      lineup: [...opts.keep.map((k) => ({ ...k, swap: false })), { target: opts.target, imageUrl: faceUrl, swap: true }],
    }),
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
  if (!parsed) return { state: "failed", code: "generic" };
  const { endpoint } = ENGINES[parsed.engine];

  const status = await fal.queue.status(endpoint, { requestId: parsed.requestId, logs: false });
  if (status.status === "IN_QUEUE") return { state: "queued", position: status.queue_position };
  if (status.status === "IN_PROGRESS") return { state: "running" };
  try {
    const result = await fal.queue.result(endpoint, { requestId: parsed.requestId });
    const url = (result.data as { video?: { url?: string } })?.video?.url;
    return url ? { state: "done", videoUrl: url } : { state: "failed", code: "generic" };
  } catch (e) {
    // 실패 원인을 Vercel 로그에서 볼 수 있게 남긴다 (사진은 들어 있지 않음)
    console.error("job failed", parsed.engine, parsed.requestId, (e as { status?: number })?.status, JSON.stringify((e as { body?: unknown })?.body ?? String(e)).slice(0, 2000));
    return { state: "failed", code: falErrorCode(e) };
  }
}

/** 너무 오래 기다린 작업을 fal 대기열에서 뺀다. 이미 만들기 시작한 작업은 fal이 거절할 수 있어 실패해도 넘어간다. */
export async function cancelJob(id: string): Promise<void> {
  const parsed = decodeId(id);
  if (!parsed) return;
  try {
    await fal.queue.cancel(ENGINES[parsed.engine].endpoint, { requestId: parsed.requestId });
  } catch (e) {
    console.warn("cancel failed", parsed.requestId, (e as { status?: number })?.status);
  }
}

/** fal 오류 → 화면 문구 코드 (lib/i18n.ts의 err.*) */
export function falErrorCode(e: unknown): "safety" | "face" | "config" | "busy" | "generic" {
  const body = JSON.stringify((e as { body?: unknown })?.body ?? "");
  // 얼굴을 못 찾은 경우와 정책(실존 인물·선정성 등) 차단을 나눠 안내한다
  if (/no (human )?face|face (was )?not|detect(ed)? (any )?face|face detection/i.test(body)) return "face";
  if (/safety|content|policy|moderat|sensitive|nsfw|partner_validation/i.test(body)) return "safety";
  const status = (e as { status?: number })?.status;
  if (status === 401 || status === 403) return "config";
  // 잔액 부족·사용 한도 초과
  if (status === 402 || /balance|exhausted|locked|credit/i.test(body)) return "config";
  if (status === 429) return "busy";
  return "generic";
}
