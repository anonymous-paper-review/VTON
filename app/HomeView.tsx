"use client";

import Link from "next/link";
import type { Video } from "@/lib/videos";
import { LangSwitch, useLang } from "./LangProvider";

const Chevron = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round"><path d="M15 18l-6-6 6-6" /></svg>
);

/** back: 링크(href) 또는 화면 안 이전 단계(onClick) */
export function TopBar({ back }: { back?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <header className="top">
      {back?.href ? (
        <Link className="icon-btn" href={back.href} aria-label={back.label}><Chevron /></Link>
      ) : back ? (
        <button className="icon-btn" onClick={back.onClick} aria-label={back.label}><Chevron /></button>
      ) : (
        <span className="brand">Hwagae<b>/</b>Market</span>
      )}
      <LangSwitch />
    </header>
  );
}

export const Arrow = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round"><path d="M5 12h14M13 6l6 6-6 6" /></svg>
);

/** 화개장터 주인공 컨셉의 큰 타이틀. 영화 크레딧처럼 언어와 관계없이 영어로 둔다. */
export const Mega = () => (
  <h1 className="mega" aria-label="Hwagae, starring you">
    <span>Hwagae</span>
    <span className="outline">Starring</span>
    <span className="hot">You.</span>
  </h1>
);

export default function HomeView({ videos }: { videos: Video[] }) {
  const { t, pick } = useLang();
  return (
    <div className="page">
      <TopBar />
      <section className="hero">
        <div className="kicker">{t("home.kicker")}</div>
        <Mega />
        <h2 className="hero-title">{t("home.title")}</h2>
        <p>{t("home.sub")}</p>
        <span className="free">{t("home.free")}</span>
      </section>

      <div className="section-h">
        <span>{t("home.scenes")}</span>
        <span>{String(videos.length).padStart(2, "0")}</span>
      </div>
      <ul className="scenes">
        {videos.map((v, i) => (
          <li key={v.id}>
            <Link className="scene" href={`/v/${v.id}`} style={v.poster ? { backgroundImage: `url(${v.poster})` } : undefined}>
              <video src={v.src} poster={v.poster} muted loop autoPlay playsInline preload="metadata" aria-hidden />
              <span className="no">No.{String(i + 1).padStart(2, "0")}</span>
              <span className="len">{v.seconds}{t("common.sec")}</span>
              <div className="meta">
                <div style={{ flex: 1 }}>
                  <h2>{pick(v.title)}</h2>
                  <p>{pick(v.description)}</p>
                </div>
                <span className="go"><Arrow /></span>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
