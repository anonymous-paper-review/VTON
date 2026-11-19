import { jobSource } from "@/lib/jobs";
import { stitch } from "@/lib/stitch";

// 완성 영상을 한 파일로 내준다: 엔진이 만든 얼굴 구간 + 원본의 얼굴 없는 구간 (lib/stitch.ts).
// 요금을 줄이려고 엔진에는 얼굴 구간만 보내기 때문에, 화면·저장·이어 보기는 모두 이 주소를 쓴다.
// 영상은 서버에 남기지 않고 요청 때마다 만든다 (10초쯤). 브라우저가 하루 동안 기억해 두므로 다시 받을 일은 드물다.
export const maxDuration = 60;

const isFal = (host: string) => host === "fal.media" || host.endsWith(".fal.media");

export async function GET(req: Request) {
  const url = new URL(req.url);
  const job = url.searchParams.get("job") ?? "";
  let src: Awaited<ReturnType<typeof jobSource>>;
  try {
    src = await jobSource(job);
  } catch (e) {
    console.error("result lookup failed", e);
    return new Response("temporarily unavailable", { status: 503 });
  }
  if (!src) return new Response("not found", { status: 404 });

  try {
    const out = await stitch({ resultUrl: src.resultUrl, fullSrc: src.video.src, origin: url.origin, parts: src.video.parts! });
    console.info("vton event", JSON.stringify({ ev: "stitched", video: src.video.id, s: out.seconds, mb: out.size / 1e6 }));
    return new Response(out.stream(), {
      headers: {
        "content-type": "video/mp4",
        "content-length": String(out.size),
        "content-disposition": 'inline; filename="hwagae-starring-me.mp4"',
        "cache-control": "private, max-age=86400",
      },
    });
  } catch (e) {
    // 이어 붙이기에 실패하면 얼굴 구간만이라도 보여 준다
    console.error("stitch failed", src.video.id, String((e as Error)?.message ?? e).slice(0, 1500));
    const raw = new URL(src.resultUrl);
    const to = isFal(raw.hostname) ? `/api/download?url=${encodeURIComponent(src.resultUrl)}` : src.resultUrl;
    return Response.redirect(new URL(to, url.origin), 307);
  }
}
