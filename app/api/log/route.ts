import { NextResponse, after } from "next/server";
import { recordEvent } from "@/lib/stats";

// 화면 단계별 결과를 Vercel 로그에 남기고 이용 통계 DB에도 쌓는다 (lib/track.ts, lib/stats.ts).
// 받은 값 중 정해진 키만, 길이를 잘라 남긴다.
const EVENTS = new Set(["visit", "view", "attempt", "consented", "saved", "photo_check", "submitted", "submit_failed", "fitted", "fit_skipped", "started", "generated", "downloaded", "download_failed", "noop_retry", "failed", "net_weak"]);
const KEYS = ["job", "video", "code", "stage", "issue", "anyway", "skipped", "s", "mb", "env", "retry", "open", "how", "path", "src", "lang", "device", "couple"];

export async function POST(req: Request) {
  try {
    const raw = await req.text();
    if (raw.length > 2000) return new NextResponse(null, { status: 413 });
    const d = JSON.parse(raw) as Record<string, unknown>;
    if (typeof d.e !== "string" || !EVENTS.has(d.e)) return new NextResponse(null, { status: 400 });
    const out: Record<string, unknown> = { e: d.e };
    for (const k of KEYS) {
      const v = d[k];
      if (typeof v === "number" && Number.isFinite(v)) out[k] = Math.round(v * 10) / 10;
      else if (typeof v === "boolean") out[k] = v;
      else if (typeof v === "string") out[k] = v.slice(0, 80);
    }
    const { device, ...logged } = out;
    console.info("vton event", JSON.stringify(logged));
    after(() => recordEvent(out));
  } catch {
    return new NextResponse(null, { status: 400 });
  }
  return new NextResponse(null, { status: 204 });
}
