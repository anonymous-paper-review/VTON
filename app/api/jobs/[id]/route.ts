import { NextResponse } from "next/server";
import { describeFalError, jobStatus } from "@/lib/jobs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    return NextResponse.json(await jobStatus(id), { headers: { "Cache-Control": "no-store" } });
  } catch (e) {
    console.error("status failed", e);
    return NextResponse.json({ state: "failed", error: describeFalError(e) }, { status: 502 });
  }
}
