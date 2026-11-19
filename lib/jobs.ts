import "server-only";
import { fal } from "@fal-ai/client";
import { ENGINES, type EngineKey } from "@/lib/engines";
import { findVideo, type Video } from "@/lib/videos";

// fal 인증: FAL_KEY 환경변수가 있으면 쓰고, 없으면 네트워크 시크릿(프록시가 Authorization 헤더를 넣는 환경)을 믿고 그대로 호출한다.
if (process.env.FAL_KEY) fal.config({ credentials: process.env.FAL_KEY });

// VTON_MOCK=1: fal을 부르지 않고 몇 초 뒤 원본 영상을 결과로 돌려준다 (화면 흐름 테스트용).
const MOCK = process.env.VTON_MOCK === "1";
const MOCK_SECONDS = 6;

// 캐릭터시트: 셀카 인물에게 영상 속 옷을 입혀 정면·반측면·측면 세 각도로 그린 한 장. 이걸 참고 사진으로 넣으면
// 바뀐 뒤에도 옷이 원본과 같고(셀카만 넣으면 셀카 옷으로 바뀐다) 옆·뒷모습 컷도 맞는다 (2026-11-19 시험).
// sync_mode라 결과가 data URI로만 돌아와 fal 저장소에 파일로 남지 않는다. VTON_SHEET=0 이면 끈다.
const SHEET_ENDPOINT = "fal-ai/nano-banana-pro/edit";
const SHEET_ON = process.env.VTON_SHEET !== "0";
/** 보통 20~30초. 이보다 오래 걸리거나 실패하면 셀카를 그대로 쓴다 (서버 함수 제한 60초 안에 끝내야 한다). */
const SHEET_TIMEOUT_MS = 40_000;

const sheetPrompt = (outfit: string) =>
  "Create a character reference sheet of exactly the same person as in the photo. " +
  "Keep the face, facial hair, glasses if any, hairstyle, skin tone, age and body build exactly the same. " +
  "Show three upper-body views of this one person side by side on a plain light gray studio background with soft even lighting: " +
  "front view, three-quarter view, and side profile. " +
  `In all three views the person wears the same outfit: ${outfit}. ` +
  "Photorealistic, natural skin texture. No text, no labels, no borders.";

/** 모의 모드에서 캐릭터시트 단계가 걸리는 시간 (진행 화면 점검용) */
const MOCK_SHEET_MS = 1500;

/** 셀카(data URI) → 캐릭터시트(data URI). 실패·시간 초과면 null. */
async function makeSheet(faceUrl: string, outfit: string): Promise<string | null> {
  const t0 = Date.now();
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const run = fal.subscribe(SHEET_ENDPOINT, {
      input: { image_urls: [faceUrl], prompt: sheetPrompt(outfit), aspect_ratio: "16:9", resolution: "1K", output_format: "jpeg", num_images: 1, sync_mode: true },
      pollInterval: 1000,
    });
    run.catch(() => {}); // 시간 초과로 먼저 빠져나간 뒤의 거절이 처리 안 된 오류로 남지 않게
    const timeout = new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new Error("sheet timeout")), SHEET_TIMEOUT_MS); });
    const res = await Promise.race([run, timeout]);
    const url = (res.data as { images?: { url?: string }[] })?.images?.[0]?.url;
    // data URI가 아니면(파일로 저장된 주소) 쓰지 않는다: 동의 화면에 "사진을 파일로 보관하지 않는다"고 안내했다.
    if (!url?.startsWith("data:image/")) throw new Error("sheet: no inline image");
    console.info("vton event", JSON.stringify({ ev: "sheet_made", s: (Date.now() - t0) / 1000 }));
    return url;
  } catch (e) {
    console.warn("sheet failed, using selfie", (Date.now() - t0) / 1000, (e as { status?: number })?.status, String((e as Error)?.message ?? e).slice(0, 200));
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type JobStatus =
  | { state: "queued"; position?: number }
  | { state: "running" }
  | { state: "done"; videoUrl: string }
  | { state: "failed"; code: string }
  /** 상태 조회가 잠깐 실패함. 화면은 다음 조회를 기다린다. */
  | { state: "unknown" };

/**
 * 클라이언트에 넘기는 job id: 엔진과 fal request id를 묶어 상태 조회 때 엔드포인트를 알 수 있게 한다.
 * 얼굴 구간만 만들어 원본과 이어 붙이는 영상은 끝에 영상 id도 붙인다 (결과를 어느 영상과 붙일지 알아야 한다).
 */
const encodeId = (engine: EngineKey, requestId: string, videoId?: string) => `${engine}.${requestId}${videoId ? `.${videoId}` : ""}`;
function decodeId(id: string): { engine: EngineKey; requestId: string; videoId?: string } | null {
  const [engine, requestId, videoId] = id.split(".");
  return requestId && engine in ENGINES ? { engine: engine as EngineKey, requestId, videoId } : null;
}

/** 작업 등록 중 실제로 끝난 단계를 화면에 알린다. sheet: 캐릭터시트(장면 의상 입히기)가 끝남, ok=false면 실패해 셀카 그대로 진행. */
export type SubmitStage = { ev: "sheet"; ok: boolean };

export async function submitJob(opts: {
  engine: EngineKey;
  videoUrl: string;
  target: string;
  /** 바꿀 인물보다 왼쪽에 있어 그대로 둘 인물들 (원본 얼굴 사진) */
  keep: { target: string; imageUrl: string }[];
  /** 바꿀 인물의 영상 속 옷차림. 있으면 캐릭터시트를 먼저 만든다. */
  outfit?: string;
  selfie: File;
  /** 결과를 원본과 이어 붙여야 하는 영상의 id (videoUrl이 얼굴 구간만 담은 생성용 영상일 때) */
  stitchVideoId?: string;
  onStage?: (s: SubmitStage) => void;
}): Promise<string> {
  const wantSheet = SHEET_ON && !!ENGINES[opts.engine].sheet && !!opts.outfit;
  if (MOCK) {
    if (wantSheet) {
      await new Promise((r) => setTimeout(r, MOCK_SHEET_MS));
      opts.onStage?.({ ev: "sheet", ok: process.env.VTON_MOCK_SHEET_FAIL !== "1" });
    }
    const payload = Buffer.from(JSON.stringify({ at: Date.now(), video: opts.videoUrl, vid: opts.stitchVideoId })).toString("base64url");
    return `mock.${payload}`;
  }
  // 셀카는 클라이언트에서 1280px JPEG로 줄여 오므로 data URI로 바로 넣는다 (실험에서 Kling·Wan·MiniMax가 받는 것을 확인).
  // fal 스토리지 업로드를 거치지 않아 사진이 별도 저장소에 남지 않는다.
  const faceUrl = `data:${opts.selfie.type};base64,${Buffer.from(await opts.selfie.arrayBuffer()).toString("base64")}`;
  const engine = ENGINES[opts.engine];
  const sheetUrl = wantSheet ? await makeSheet(faceUrl, opts.outfit!) : null;
  if (wantSheet) opts.onStage?.({ ev: "sheet", ok: !!sheetUrl });
  const refUrl = sheetUrl ?? faceUrl;
  const { request_id } = await fal.queue.submit(engine.endpoint, {
    input: engine.build({
      videoUrl: opts.videoUrl,
      faceUrl: refUrl,
      target: opts.target,
      lineup: [...opts.keep.map((k) => ({ ...k, swap: false })), { target: opts.target, imageUrl: refUrl, swap: true, sheet: !!sheetUrl }],
    }),
    // 만든 영상 등 fal 저장소 파일을 24시간 뒤 자동 삭제한다 (동의 화면의 보유 기간과 맞춤).
    storageSettings: { expiresIn: "1d" },
  });
  return encodeId(opts.engine, request_id, opts.stitchVideoId);
}

/** 캐릭터시트를 만드는 조건인지 (화면이 「장면 의상」 단계를 보일지 정한다) */
export const willMakeSheet = (engine: EngineKey, outfit?: string) => SHEET_ON && !!ENGINES[engine].sheet && !!outfit;

/** 이어 붙일 영상 (job id에 붙어 온 영상 id가 구간 정보를 가진 영상일 때) */
const stitchVideo = (videoId?: string): Video | undefined => {
  const v = videoId ? findVideo(videoId) : undefined;
  return v?.gen && v.parts ? v : undefined;
};

/** 화면에 주는 상태. 이어 붙이는 영상은 완성 주소를 fal 주소 대신 우리 서버의 이어 붙이기 주소(/api/result)로 준다. */
export async function jobStatus(id: string): Promise<JobStatus> {
  const s = await rawStatus(id);
  if (s.state !== "done" || !s.stitch) return s.state === "done" ? { state: "done", videoUrl: s.videoUrl } : s;
  return { state: "done", videoUrl: `/api/result?job=${encodeURIComponent(id)}` };
}

/** 이어 붙이기에 쓸 재료: 엔진이 만든 결과(얼굴 구간) 주소와 붙일 영상. 아직 완성 전이거나 이어 붙이는 영상이 아니면 null. */
export async function jobSource(id: string): Promise<{ resultUrl: string; video: Video } | null> {
  const s = await rawStatus(id);
  return s.state === "done" && s.stitch ? { resultUrl: s.videoUrl, video: s.stitch } : null;
}

type RawStatus = Exclude<JobStatus, { state: "done" }> | { state: "done"; videoUrl: string; stitch?: Video };

async function rawStatus(id: string): Promise<RawStatus> {
  // 모의 작업 id는 모의 모드에서만 받는다. 실서버에서 받으면 링크에 아무 영상 주소나 넣어 우리 화면에 띄울 수 있다.
  if (id.startsWith("mock.")) {
    if (!MOCK) return { state: "failed", code: "generic" };
    const { at, video, vid } = JSON.parse(Buffer.from(id.slice(5), "base64url").toString());
    const elapsed = (Date.now() - at) / 1000;
    if (elapsed < 2) return { state: "queued", position: 1 };
    if (elapsed < MOCK_SECONDS) return { state: "running" };
    return { state: "done", videoUrl: video, stitch: stitchVideo(vid) };
  }
  const parsed = decodeId(id);
  if (!parsed) return { state: "failed", code: "generic" };
  const { endpoint } = ENGINES[parsed.engine];

  let status;
  try {
    status = await fal.queue.status(endpoint, { requestId: parsed.requestId, logs: false });
  } catch (e) {
    // 상태 조회만 잠깐 실패한 경우(네트워크·fal 일시 오류): 작업은 그대로 진행 중일 수 있으니 실패로 치지 않는다.
    // 실패로 돌려주면 화면이 같은 셀카로 새 작업을 또 맡겨 요금이 두 번 나간다.
    const code = (e as { status?: number })?.status;
    if (code === 404 || code === 422) return { state: "failed", code: "generic" }; // 없는 작업 id
    if (code === 401 || code === 403) return { state: "failed", code: "config" };
    console.warn("status check failed", parsed.requestId, code);
    return { state: "unknown" };
  }
  if (status.status === "IN_QUEUE") return { state: "queued", position: status.queue_position };
  if (status.status === "IN_PROGRESS") return { state: "running" };
  try {
    const result = await fal.queue.result(endpoint, { requestId: parsed.requestId });
    const url = (result.data as { video?: { url?: string } })?.video?.url;
    return url ? { state: "done", videoUrl: url, stitch: stitchVideo(parsed.videoId) } : { state: "failed", code: "generic" };
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
