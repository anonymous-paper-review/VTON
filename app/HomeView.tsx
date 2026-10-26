"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listJobs, type MyJob } from "@/lib/myJobs";
import { GROUPS, type Group, type Video } from "@/lib/videos";
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

/** 화개장터 주인공 컨셉의 큰 타이틀 (세 줄: 한지색, 금색, 주칠) */
export const Mega = ({ lines }: { lines: [string, string, string] }) => (
  <h1 className="mega">
    <span>{lines[0]}</span>
    <span className="gold">{lines[1]}</span>
    <span className="hot">{lines[2]}</span>
  </h1>
);

/** 영상을 자르지 않고 원래 비율 그대로 보여 준다 (가로·세로 모두). 남는 자리는 포스터를 흐리게 깐다. */
export function Frame({ poster, className, children }: { poster?: string; className?: string; children: React.ReactNode }) {
  return (
    <div className={`frame${className ? ` ${className}` : ""}`} style={poster ? ({ "--poster": `url(${poster})` } as React.CSSProperties) : undefined}>
      {children}
    </div>
  );
}

export default function HomeView({ videos }: { videos: Video[] }) {
  const { t, pick } = useLang();
  const [tab, setTab] = useState<Group>("simni");
  const shown = videos.filter((v) => v.group === tab);
  // 앱을 닫았다 다시 QR로 들어온 사람에게 만들던 영상을 바로 보여 준다
  const [mine, setMine] = useState<MyJob[]>([]);
  useEffect(() => { setMine(listJobs().slice(0, 3)); }, []);
  return (
    <div className="page">
      <TopBar />
      <section className="hero">
        <div className="kicker">{t("home.kicker")}</div>
        <Mega lines={[t("home.mega1"), t("home.mega2"), t("home.mega3")]} />
        <p>{t("home.sub")}</p>
        <span className="free">{t("home.free")}</span>
      </section>

      {mine.length > 0 && (
        <section className="mine">
          <div className="section-h"><span>{t("home.mine")}</span></div>
          {mine.map((j) => {
            const v = videos.find((x) => x.id === j.videoId);
            if (!v) return null;
            return (
              <Link key={j.jobId} className="mine-row" href={`/v/${v.id}?job=${encodeURIComponent(j.jobId)}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                {v.poster && <img src={v.poster} alt="" />}
                <span className="mine-title">{pick(v.title)}</span>
                <span className={j.resultUrl ? "badge ready" : "badge"}>{t(j.resultUrl ? "home.ready" : "home.making")}</span>
              </Link>
            );
          })}
        </section>
      )}

      <div className="tabs" role="tablist">
        {GROUPS.map((g) => (
          <button key={g} role="tab" aria-selected={tab === g} onClick={() => setTab(g)}>
            {t(`tab.${g}`)}
            <small>{g === "simni" ? "3:4" : "16:9"}</small>
          </button>
        ))}
      </div>
      <div className="section-h">
        <span>{t("home.scenes")}</span>
        <span>{String(shown.length).padStart(2, "0")}</span>
      </div>
      <ul className="scenes">
        {shown.map((v, i) => (
          <li key={v.id}>
            <Link className="scene" href={`/v/${v.id}`}>
              <Frame poster={v.poster}>
                <video src={v.src} poster={v.poster} muted loop autoPlay playsInline preload="metadata" aria-hidden />
                <span className="no">No.{String(i + 1).padStart(2, "0")}</span>
                <span className="len">{v.seconds}{t("common.sec")}</span>
              </Frame>
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
