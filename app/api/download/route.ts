// 결과 영상을 같은 출처로 받아 오게 해 주는 통로.
// fal 링크는 다른 출처라 브라우저가 download 속성을 무시하고 새 탭으로 열어 버려서, 휴대폰 갤러리에 저장할 수 없다.
// 같은 출처에서 받은 파일이어야 공유 시트("동영상 저장")나 다운로드로 넘길 수 있다.

const ALLOWED = (host: string) => host === "fal.media" || host.endsWith(".fal.media");

export async function GET(req: Request) {
  const raw = new URL(req.url).searchParams.get("url");
  let target: URL;
  try {
    target = new URL(raw ?? "");
  } catch {
    return new Response("bad url", { status: 400 });
  }
  if (target.protocol !== "https:" || !ALLOWED(target.hostname)) return new Response("forbidden", { status: 403 });

  const upstream = await fetch(target, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new Response("upstream error", { status: 502 });
  return new Response(upstream.body, {
    headers: {
      "content-type": upstream.headers.get("content-type") ?? "video/mp4",
      ...(upstream.headers.get("content-length") ? { "content-length": upstream.headers.get("content-length")! } : {}),
      "content-disposition": 'attachment; filename="hwagae-starring-me.mp4"',
      "cache-control": "private, max-age=3600",
    },
  });
}
