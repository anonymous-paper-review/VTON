import Link from "next/link";
import { notFound } from "next/navigation";
import { findVideo, videos } from "@/lib/videos";
import { CONSENT_VERSION, consentItems } from "@/lib/consent";
import SwapFlow from "./SwapFlow";

export function generateStaticParams() {
  return videos.map((v) => ({ id: v.id }));
}

export default async function VideoPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const video = findVideo(id);
  if (!video) notFound();

  return (
    <>
      <Link className="back" href="/">← 영상 목록</Link>
      <SwapFlow
        video={video}
        consent={{ version: CONSENT_VERSION, items: consentItems.map((c) => ({ id: c.id, title: c.title, body: [...c.body] })) }}
      />
    </>
  );
}
