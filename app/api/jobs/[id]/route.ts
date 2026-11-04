import { NextResponse } from "next/server";
import { cancelJob, falErrorCode, jobStatus } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await jobStatus(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("status failed", e);
    return NextResponse.json({ state: "failed", code: falErrorCode(e) }, { status: 502 });
  }
}

/** 화면에서 너무 오래 기다려 포기한 작업을 대기열에서 뺀다 (아직 시작 전이면 요금이 나가지 않음). */
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  await cancelJob(id);
  return new NextResponse(null, { status: 204 });
}
