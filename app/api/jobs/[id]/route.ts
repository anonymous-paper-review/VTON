import { NextResponse } from "next/server";
import { falErrorCode, jobStatus } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await jobStatus(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("status failed", e);
    return NextResponse.json({ state: "failed", code: falErrorCode(e) }, { status: 502 });
  }
}
