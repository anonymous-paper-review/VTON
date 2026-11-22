import { NextResponse } from "next/server";
import { CONSENT_VERSION, requiredConsent } from "@/lib/consent";
import { ENGINES, engineKey } from "@/lib/engines";
import { falErrorCode, submitJob, willMakeSheet, type Person } from "@/lib/jobs";
import { absoluteUrl, findVideo } from "@/lib/videos";
import { isGenerationOpen } from "@/lib/open";

const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

/** 둘이 함께 바꾸기(커플): role 값. 셀카는 인물마다 selfie.<인물 id> 로 받는다. */
const BOTH = "both";

// 캐릭터시트를 만든 뒤(20~30초, 최대 40초) 영상 작업을 맡기고 답한다.
export const maxDuration = 60;

export async function POST(req: Request) {
  if (!isGenerationOpen()) return NextResponse.json({ code: "closed" }, { status: 503 });
  const form = await req.formData();
  const video = findVideo(String(form.get("videoId") ?? ""));
  const agreed = form.getAll("consent").map(String);
  if (!video) return NextResponse.json({ code: "video" }, { status: 404 });
  const couple = form.get("role") === BOTH;
  const roleIndex = couple ? video.cast.length - 1 : video.cast.findIndex((c) => c.id === form.get("role"));
  if (roleIndex < 0 || (couple && video.cast.length < 2)) return NextResponse.json({ code: "role" }, { status: 400 });
  if (form.get("consentVersion") !== CONSENT_VERSION || !requiredConsent(couple).every((c) => agreed.includes(c.id)))
    return NextResponse.json({ code: "consent" }, { status: 400 });
  // 바꿀 인물마다 셀카 한 장
  const selfies = couple ? video.cast.map((c) => form.get(`selfie.${c.id}`)) : [form.get("selfie")];
  for (const selfie of selfies) {
    if (!(selfie instanceof File) || !selfie.type.startsWith("image/"))
      return NextResponse.json({ code: "selfie" }, { status: 400 });
    if (selfie.size > MAX_SELFIE_BYTES)
      return NextResponse.json({ code: "tooBig" }, { status: 413 });
  }

  const engine = engineKey();
  if (couple && !ENGINES[engine].multi) return NextResponse.json({ code: "role" }, { status: 422 });
  const { minSeconds, maxSeconds } = ENGINES[engine];
  // 얼굴 구간만 담은 생성용 영상이 있으면 엔진에는 그것만 보낸다 (요금이 길이에 비례). 나머지 구간은 결과에 원본을 이어 붙인다.
  const source = video.gen && video.parts ? video.gen : null;
  const seconds = source?.seconds ?? video.seconds;
  if (seconds < minSeconds || seconds > maxSeconds)
    return NextResponse.json({ code: "length" }, { status: 422 });

  // 동의 기록. 지금은 서버 로그에만 남긴다 (사진·개인 식별 정보는 남기지 않음).
  console.info("consent", JSON.stringify({ version: CONSENT_VERSION, agreedAt: new Date().toISOString(), items: agreed, videoId: video.id, couple }));

  // 화면 왼쪽부터 바꿀 인물까지 줄 세운다. 혼자 바꾸면 바꿀 인물보다 왼쪽 인물은 원본 얼굴로 고정한다.
  const origin = new URL(req.url).origin;
  const people: Person[] = [];
  for (const [i, c] of video.cast.slice(0, roleIndex + 1).entries()) {
    if (couple || i === roleIndex) people.push({ kind: "swap", target: c.target, outfit: c.outfit, selfie: selfies[couple ? i : 0] as File });
    else if (c.still) people.push({ kind: "keep", target: c.target, imageUrl: absoluteUrl(c.still, origin) });
    else return NextResponse.json({ code: "role" }, { status: 422 });
  }
  const swaps = people.filter((p) => p.kind === "swap");

  // 여기부터는 한 줄에 JSON 하나씩 흘려보낸다. 화면의 단계 표시가 실제로 끝난 일에 맞춰 넘어가게 하기 위해서다.
  //   {ev:"received", sheet}  사진을 받음 (sheet: 장면 의상 단계가 있는지)
  //   {ev:"sheet", ok}        장면 의상(캐릭터시트) 단계가 끝남. ok=false면 실패해 사진 그대로 진행
  //   {jobId} 또는 {code}     영상 엔진에 넘김 / 실패
  const enc = new TextEncoder();
  const body = new ReadableStream<Uint8Array>({
    async start(ctrl) {
      const send = (o: object, pad = 0) => ctrl.enqueue(enc.encode(JSON.stringify(o) + " ".repeat(pad) + "\n"));
      // 첫 덩어리를 모아 두는 브라우저가 있어 공백을 붙여 바로 전달되게 한다
      send({ ev: "received", sheet: swaps.some((p) => willMakeSheet(engine, p.outfit, swaps.length)) }, 1024);
      try {
        const jobId = await submitJob({
          engine,
          videoUrl: absoluteUrl(source?.src ?? video.src, origin),
          people,
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
