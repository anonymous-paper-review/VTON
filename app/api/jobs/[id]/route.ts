import { NextResponse } from "next/server";
import { cancelJob, jobStatus } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await jobStatus(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("status failed", e);
    // 예상 못 한 오류도 작업 실패로 단정하지 않는다 (새 작업을 또 맡기지 않게). 화면의 시간 제한이 끝을 맺는다.
    return NextResponse.json({ state: "unknown" }, { status: 503, headers: { "Cache-Control": "no-store" } });
  }
}

/** 화면에서 너무 오래 기다려 포기한 작업을 대기열에서 뺀다 (아직 시작 전이면 요금이 나가지 않음). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await cancelJob(id);
  return new NextResponse(null, { status: 204 });
}
