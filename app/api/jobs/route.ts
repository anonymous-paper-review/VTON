import { NextResponse } from "next/server";
import { CONSENT_VERSION, consentItems } from "@/lib/consent";
import { ENGINES, engineKey } from "@/lib/engines";
import { describeFalError, submitJob } from "@/lib/jobs";
import { absoluteUrl, findVideo } from "@/lib/videos";

const MAX_SELFIE_BYTES = 8 * 1024 * 1024;

export async function POST(req: Request) {
  const form = await req.formData();
  const video = findVideo(String(form.get("videoId") ?? ""));
  const selfie = form.get("selfie");
  const agreed = form.getAll("consent").map(String);
  const roleIndex = video ? video.cast.findIndex((c) => c.id === form.get("role")) : -1;

  if (!video) return NextResponse.json({ error: "영상을 찾을 수 없어요." }, { status: 404 });
  if (roleIndex < 0) return NextResponse.json({ error: "바꿀 인물을 골라 주세요." }, { status: 400 });
  if (form.get("consentVersion") !== CONSENT_VERSION || !consentItems.every((c) => agreed.includes(c.id)))
    return NextResponse.json({ error: "개인정보 동의가 필요해요." }, { status: 400 });
  if (!(selfie instanceof File) || !selfie.type.startsWith("image/"))
    return NextResponse.json({ error: "셀카 사진이 필요해요." }, { status: 400 });
  if (selfie.size > MAX_SELFIE_BYTES)
    return NextResponse.json({ error: "사진이 너무 커요." }, { status: 413 });

  const engine = engineKey();
  const { minSeconds, maxSeconds } = ENGINES[engine];
  if (video.seconds < minSeconds || video.seconds > maxSeconds)
    return NextResponse.json({ error: "이 영상은 지금 엔진으로 처리할 수 없는 길이예요." }, { status: 422 });

  // 동의 기록. 지금은 서버 로그에만 남긴다 (사진·개인 식별 정보는 남기지 않음).
  console.info("consent", JSON.stringify({ version: CONSENT_VERSION, agreedAt: new Date().toISOString(), items: agreed, videoId: video.id }));

  // 바꿀 인물보다 왼쪽 인물은 원본 얼굴로 고정한다
  const origin = new URL(req.url).origin;
  const left = video.cast.slice(0, roleIndex);
  if (left.some((c) => !c.still))
    return NextResponse.json({ error: "이 인물은 아직 고를 수 없어요." }, { status: 422 });
  const role = video.cast[roleIndex];

  try {
    const jobId = await submitJob({
      engine,
      videoUrl: absoluteUrl(video.src, origin),
      target: role.target,
      keep: left.map((c) => ({ target: c.target, imageUrl: absoluteUrl(c.still!, origin) })),
      selfie,
    });
    return NextResponse.json({ jobId });
  } catch (e) {
    console.error("submit failed", e);
    return NextResponse.json({ error: describeFalError(e) }, { status: 502 });
  }
}
