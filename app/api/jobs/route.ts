import { NextResponse } from "next/server";
import { CONSENT_VERSION, consentItems } from "@/lib/consent";
import { ENGINES, engineKey } from "@/lib/engines";
import { falErrorCode, submitJob, willMakeSheet } from "@/lib/jobs";
import { absoluteUrl, findVideo } from "@/lib/videos";
import { GENERATION_OPEN } from "@/lib/open";

const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

// 캐릭터시트를 만든 뒤(20~30초, 최대 40초) 영상 작업을 맡기고 답한다.
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!GENERATION_OPEN) return NextResponse.json({ code: "closed" }, { status: 503 });
  const form = await req.formData();
  const video = findVideo(String(form.get("videoId") ?? ""));
  const selfie = form.get("selfie");
  const agreed = form.getAll("consent").map(String);
  const roleIndex = video ? video.cast.findIndex((c) => c.id === form.get("role")) : -1;

  if (!video) return NextResponse.json({ code: "video" }, { status: 404 });
  if (roleIndex < 0) return NextResponse.json({ code: "role" }, { status: 400 });
  if (form.get("consentVersion") !== CONSENT_VERSION || !consentItems.every((c) => agreed.includes(c.id)))
    return NextResponse.json({ code: "consent" }, { status: 400 });
  if (!(selfie instanceof File) || !selfie.type.startsWith("image/"))
    return NextResponse.json({ code: "selfie" }, { status: 400 });
  if (selfie.size > MAX_SELFIE_BYTES)
    return NextResponse.json({ code: "tooBig" }, { status: 413 });

  const engine = engineKey();
  const { minSeconds, maxSeconds } = ENGINES[engine];
  // 얼굴 구간만 담은 생성용 영상이 있으면 엔진에는 그것만 보낸다 (요금이 길이에 비례). 나머지 구간은 결과에 원본을 이어 붙인다.
  const source = video.gen && video.parts ? video.gen : null;
  const seconds = source?.seconds ?? video.seconds;
  if (seconds < minSeconds || seconds > maxSeconds)
    return NextResponse.json({ code: "length" }, { status: 422 });

  // 동의 기록. 지금은 서버 로그에만 남긴다 (사진·개인 식별 정보는 남기지 않음).
  console.info("consent", JSON.stringify({ version: CONSENT_VERSION, agreedAt: new Date().toISOString(), items: agreed, videoId: video.id }));

  // 바꿀 인물보다 왼쪽 인물은 원본 얼굴로 고정한다
  const origin = new URL(req.url).origin;
  const left = video.cast.slice(0, roleIndex);
  if (left.some((c) => !c.still))
    return NextResponse.json({ code: "role" }, { status: 422 });
  const role = video.cast[roleIndex];

  // 여기부터는 한 줄에 JSON 하나씩 흘려보낸다. 화면의 단계 표시가 실제로 끝난 일에 맞춰 넘어가게 하기 위해서다.
  //   {ev:"received", sheet}  사진을 받음 (sheet: 장면 의상 단계가 있는지)
  //   {ev:"sheet", ok}        장면 의상(캐릭터시트) 단계가 끝남. ok=false면 실패해 사진 그대로 진행
  //   {jobId} 또는 {code}     영상 엔진에 넘김 / 실패
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (o: object, pad = 0) => ctrl.enqueue(enc.encode(JSON.stringify(o) + " ".repeat(pad) + "\n"));
      // 첫 덩어리를 모아 두는 브라우저가 있어 공백을 붙여 바로 전달되게 한다
      send({ ev: "received", sheet: willMakeSheet(engine, role.outfit) }, 1024);
      try {
        const jobId = await submitJob({
          engine,
          videoUrl: absoluteUrl(source?.src ?? video.src, origin),
          target: role.target,
          keep: left.map((c) => ({ target: c.target, imageUrl: absoluteUrl(c.still!, origin) })),
          outfit: role.outfit,
          selfie,
          stitchVideoId: source ? video.id : undefined,
          onStage: send,
        });
        send({ jobId });
      } catch (e) {
        console.error("submit failed", e);
        send({ code: falErrorCode(e) });
      }
      ctrl.close();
    },
  });
  return new Response(body, {
    headers: { "content-type": "application/x-ndjson; charset=utf-8", "cache-control": "no-store, no-transform", "x-accel-buffering": "no" },
  });
}
