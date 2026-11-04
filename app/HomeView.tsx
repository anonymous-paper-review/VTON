"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { listJobs, type MyJob } from "@/lib/myJobs";
import { GROUPS, type Group, type Video } from "@/lib/videos";
import { LangSwitch, useLang } from "./LangProvider";
import { Back, Chevron, Clock, Pin } from "./icons";

/** 헤더 56 · ← + 가운데 제목 + 언어. back: 링크(href) 또는 화면 안 이전 단계(onClick). 없으면 왼쪽은 빈칸. */
export function TopBar({ title, back }: { title: string; back?: { label: string; href?: string; onClick?: () => void } }) {
  return (
    <header className="top">
      {back?.href ? (
        <Link className="icon-btn" href={back.href} aria-label={back.label}><Back size={24} /></Link>
      ) : back ? (
        <button className="icon-btn" onClick={back.onClick} aria-label={back.label}><Back size={24} /></button>
      ) : (
        <span />
      )}
      <h1>{title}</h1>
      <LangSwitch />
    </header>
  );
}

/** 화개장터 주인공 큰 제목 (세 줄, 마지막 줄만 녹차) */
export const Display = ({ lines }: { lines: [string, string, string] }) => (
  <h2 className="display">
    <span>{lines[0]}</span>
    <span>{lines[1]}</span>
    <span className="brand">{lines[2]}</span>
  </h2>
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
      <TopBar title={t("app.name")} />
      <section className="hero">
        <div className="place"><Pin />{t("home.place")}</div>
        <Display lines={[t("home.mega1"), t("home.mega2"), t("home.mega3")]} />
        <p>{t("home.sub")}</p>
        <div className="chips"><span className="chip">{t("home.free")}</span></div>
      </section>

      {mine.length > 0 && (
        <>
          <div className="band" />
          <div className="sec"><h2>{t("home.mine")}</h2></div>
          <div className="mine">
            {mine.map((j) => {
              const v = videos.find((x) => x.id === j.videoId);
              if (!v) return null;
              return (
                <Link key={j.jobId} className="card mine-card" href={`/v/${v.id}?job=${encodeURIComponent(j.jobId)}`} aria-label={`${pick(v.title)} · ${t("home.resume")}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  {v.poster && <img src={v.poster} alt="" />}
                  <span className="t">
                    <b>{pick(v.title)}</b>
                    <span className={j.resultUrl ? "chip done" : "chip"}>{t(j.resultUrl ? "home.ready" : "home.making")}</span>
                  </span>
                  <Chevron />
                </Link>
              );
            })}
          </div>
        </>
      )}

      <div className="band" />
      <div className="sec">
        <h2>{t("home.scenes")}</h2>
        <span>{shown.length}</span>
      </div>
      <div className="tabs" role="tablist">
        {GROUPS.map((g) => (
          <button key={g} className="chip" role="tab" aria-selected={tab === g} onClick={() => setTab(g)}>
            {t(`tab.${g}`)}
          </button>
        ))}
      </div>
      <ul className="scenes">
        {shown.map((v, i) => (
          <li key={v.id}>
            <Link className="card scene" href={`/v/${v.id}`}>
              <Frame poster={v.poster}>
                <video src={v.src} poster={v.poster} muted loop autoPlay playsInline preload="metadata" aria-hidden />
                <span className="chip on-video"><Clock />{v.seconds}{t("common.sec")}</span>
              </Frame>
              <div className="meta">
                <span className="num">{i + 1}</span>
                <div>
                  <h3>{pick(v.title)}</h3>
                  <p>{pick(v.description)}</p>
                </div>
                <Chevron />
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
