import type { Metadata } from "next";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { findVideo } from "@/lib/videos";
import { readStats, statsEnabled, type Stats } from "@/lib/stats";

// 운영자용 이용 통계 (관광공사 보고용). 비밀번호는 DB(vton_admin)에 해시로만 있다.
// 사람 수 = 서로 다른 기기 수(기기마다 만든 익명 id). 날짜는 한국 시간 기준.
export const metadata: Metadata = { title: "이용 통계", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

const COOKIE = "vton_admin";
const ymd = (d: Date) => new Date(d.getTime() + 9 * 3600_000).toISOString().slice(0, 10);
const isDate = (s?: string) => !!s && /^\d{4}-\d{2}-\d{2}$/.test(s);
// KPI 집계 시작일: 정식 오픈(생성 열림)일. 그 전 기록(시험·점검)은 보고 숫자에 넣지 않는다 (오너 2026-11-22).
const KPI_START = "2026-11-30";
const atLeast = (d: string) => (d < KPI_START ? KPI_START : d);

async function login(form: FormData) {
  "use server";
  const key = String(form.get("key") ?? "").trim();
  (await cookies()).set(COOKIE, key, { httpOnly: true, secure: true, sameSite: "lax", path: "/admin", maxAge: 60 * 60 * 24 * 30 });
  redirect("/admin/stats");
}
async function logout() {
  "use server";
  (await cookies()).delete({ name: COOKIE, path: "/admin" });
  redirect("/admin/stats");
}

const SRC: Record<string, string> = { direct: "QR 스캔·주소 직접 입력", map: "AI관광집사(지도)에서", link: "다른 사이트 링크" };
const LANG: Record<string, string> = { ko: "한국어", en: "English", zh: "中文", ja: "日本語" };
const OS: Record<string, string> = { ios: "iPhone", android: "안드로이드", other: "PC·기타" };
const envLabel = (k: string) => {
  const [os, app] = k.split("-");
  return (OS[os] ?? os) + (app ? ` (${{ kakao: "카카오톡", naver: "네이버", meta: "인스타·페북", line: "라인", wechat: "위챗" }[app] ?? app} 앱 안)` : "");
};
const title = (id: string) => findVideo(id)?.title.ko ?? id;

export default async function StatsPage({ searchParams }: { searchParams: Promise<{ from?: string; to?: string }> }) {
  const sp = await searchParams;
  const key = (await cookies()).get(COOKIE)?.value;
  const today = ymd(new Date());
  const from = atLeast(isDate(sp.from) ? sp.from! : KPI_START);
  const to = atLeast(isDate(sp.to) ? sp.to! : today);

  if (!statsEnabled) return <Shell><p>통계 DB 연결 설정(VTON_STATS_URL, VTON_STATS_KEY)이 없는 배포입니다. 운영 주소에서 열어 주세요.</p></Shell>;
  const stats = key ? await readStats(key, from, to) : "denied";
  if (stats === "denied") {
    return (
      <Shell>
        {key && <p style={{ color: "var(--brick)" }}>비밀번호가 맞지 않아요.</p>}
        <form action={login} style={{ display: "flex", gap: 8 }}>
          <input name="key" type="password" placeholder="비밀번호" autoComplete="current-password" style={inp} />
          <button className="btn" style={{ width: "auto", padding: "0 20px" }}>보기</button>
        </form>
      </Shell>
    );
  }
  if (stats === "error") return <Shell><p>통계를 불러오지 못했어요. 잠시 뒤 새로고침해 주세요.</p></Shell>;

  return <Report s={stats} from={from} to={to} today={today} logout={logout} />;
}

function Report({ s, from, to, today, logout }: { s: Stats; from: string; to: string; today: string; logout: () => Promise<void> }) {
  const u = (e: string) => s.totals[e]?.u ?? 0;
  const n = (e: string) => s.totals[e]?.n ?? 0;
  const funnel: [string, string, string][] = [
    ["visit", "앱에 들어온 사용자", "QR·링크로 앱을 연 사람"],
    ["view", "영상을 재생한 사용자", "장면을 골라 영상을 본 사람"],
    ["attempt", "생성을 시도한 사용자", "「주인공 되기」를 누른 사람 (생성 잠금 중에도 셈)"],
    ["consented", "개인정보 동의한 사용자", ""],
    ["submitted", "셀카를 보낸 사용자", "실제 생성 요청"],
    ["generated", "영상이 완성된 사용자", ""],
    ["saved", "결과를 저장·공유한 사용자", ""],
  ];
  const csv = [
    ["날짜", "진입 사용자", "영상 재생 사용자", "생성 시도 사용자", "셀카 보낸 사용자", "완성 사용자", "저장·공유 사용자"].join(","),
    ...s.daily.map((d) => [d.d, d.visit, d.view, d.attempt, d.submitted, d.generated, d.saved].join(",")),
    ["합계(기간 중 서로 다른 사용자)", u("visit"), u("view"), u("attempt"), u("submitted"), u("generated"), u("saved")].join(","),
  ].join("\n");
  const href = "data:text/csv;charset=utf-8," + encodeURIComponent("﻿" + csv);
  const quick = (label: string, f: string) => <a className="chip" href={`?from=${f}&to=${today}`}>{label}</a>;
  const daysAgo = (k: number) => ymd(new Date(Date.now() - k * 86400_000));

  return (
    <Shell>
      <form style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
        <input type="date" name="from" defaultValue={from} min={KPI_START} style={inp} />
        <span>~</span>
        <input type="date" name="to" defaultValue={to} style={inp} />
        <button className="btn sub" style={{ width: "auto", padding: "0 16px", height: 40 }}>보기</button>
      </form>
      <div className="chips" style={{ marginTop: 8 }}>
        {quick("오늘", today)}{quick("최근 7일", atLeast(daysAgo(6)))}{quick("최근 30일", atLeast(daysAgo(29)))}{quick("전체", KPI_START)}
      </div>
      <p className="small" style={{ marginTop: 8 }}>사람 수는 서로 다른 기기 수입니다(기기마다 만든 익명 번호, 개인정보 없음). 날짜는 한국 시간. KPI 집계 시작: {KPI_START} (정식 오픈일, 그 전 시험 기록은 빼고 셈)</p>

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(150px,1fr))", gap: 8, marginTop: 16 }}>
        {funnel.slice(0, 3).map(([e, label]) => (
          <div key={e} style={{ ...card, borderColor: "var(--green)" }}>
            <div className="small">{label}</div>
            <div style={{ fontSize: 34, fontWeight: 700, color: "var(--green)" }}>{u(e).toLocaleString()}<span style={{ fontSize: 16 }}>명</span></div>
            <div className="small">횟수 {n(e).toLocaleString()}</div>
          </div>
        ))}
      </section>

      <h3 style={h3}>단계별 (기간 중 서로 다른 사용자)</h3>
      <table style={tbl}>
        <thead><tr><th style={th}>단계</th><th style={thr}>사용자</th><th style={thr}>횟수</th><th style={thr}>진입 대비</th></tr></thead>
        <tbody>
          {funnel.map(([e, label, note]) => (
            <tr key={e}><td style={td}>{label}{note && <div className="small">{note}</div>}</td><td style={tdr}>{u(e)}</td><td style={tdr}>{n(e)}</td><td style={tdr}>{u("visit") ? `${Math.round((u(e) / u("visit")) * 100)}%` : "-"}</td></tr>
          ))}
          <tr><td style={td}>다시 찾은 사용자<div className="small">이틀 이상 들어온 사람</div></td><td style={tdr}>{s.returning}</td><td style={tdr}></td><td style={tdr}>{u("visit") ? `${Math.round((s.returning / u("visit")) * 100)}%` : "-"}</td></tr>
          <tr><td style={td}>생성 실패</td><td style={tdr}>{u("failed")}</td><td style={tdr}>{n("failed")}</td><td style={tdr}></td></tr>
        </tbody>
      </table>

      <h3 style={h3}>날짜별 사용자</h3>
      <a className="text-btn" href={href} download={`화개장터-이용통계-${from}_${to}.csv`}>엑셀(CSV)로 받기</a>
      <table style={tbl}>
        <thead><tr><th style={th}>날짜</th><th style={thr}>진입</th><th style={thr}>재생</th><th style={thr}>시도</th><th style={thr}>셀카</th><th style={thr}>완성</th><th style={thr}>저장</th></tr></thead>
        <tbody>
          {s.daily.length === 0 && <tr><td style={td} colSpan={7}>기록 없음</td></tr>}
          {s.daily.map((d) => <tr key={d.d}><td style={td}>{d.d}</td><td style={tdr}>{d.visit}</td><td style={tdr}>{d.view}</td><td style={tdr}>{d.attempt}</td><td style={tdr}>{d.submitted}</td><td style={tdr}>{d.generated}</td><td style={tdr}>{d.saved}</td></tr>)}
        </tbody>
      </table>

      <h3 style={h3}>영상별 사용자</h3>
      <table style={tbl}>
        <thead><tr><th style={th}>영상</th><th style={thr}>재생</th><th style={thr}>시도</th><th style={thr}>셀카</th></tr></thead>
        <tbody>
          {s.byVideo.length === 0 && <tr><td style={td} colSpan={4}>기록 없음</td></tr>}
          {s.byVideo.map((v) => <tr key={v.video}><td style={td}>{title(v.video)}</td><td style={tdr}>{v.view}</td><td style={tdr}>{v.attempt}</td><td style={tdr}>{v.submitted}</td></tr>)}
        </tbody>
      </table>

      <Split title="언어별 진입 사용자" data={s.byLang} label={(k) => LANG[k] ?? k} />
      <Split title="들어온 길" data={s.bySrc} label={(k) => SRC[k] ?? k} />
      <Split title="기기별 진입 사용자" data={s.byEnv} label={envLabel} />

      <form action={logout} style={{ marginTop: 32 }}><button className="text-btn">로그아웃</button></form>
    </Shell>
  );
}

function Split({ title, data, label }: { title: string; data: Record<string, number>; label: (k: string) => string }) {
  const rows = Object.entries(data).sort((a, b) => b[1] - a[1]);
  const sum = rows.reduce((a, [, v]) => a + v, 0);
  return (
    <>
      <h3 style={h3}>{title}</h3>
      <table style={tbl}>
        <tbody>
          {rows.length === 0 && <tr><td style={td}>기록 없음</td></tr>}
          {rows.map(([k, v]) => <tr key={k}><td style={td}>{label(k)}</td><td style={tdr}>{v}</td><td style={tdr}>{sum ? `${Math.round((v / sum) * 100)}%` : ""}</td></tr>)}
        </tbody>
      </table>
    </>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main style={{ maxWidth: 720, margin: "0 auto", padding: "24px 16px 48px", textAlign: "left" }} lang="ko" className="stats">
      <h1 style={{ fontSize: 24, fontWeight: 700, marginBottom: 4 }}>화개장터 주인공 되기 · 이용 통계</h1>
      <p className="small" style={{ marginBottom: 16, textAlign: "left" }}>운영자 전용</p>
      <style>{`.stats .small{text-align:left}`}</style>
      {children}
    </main>
  );
}

const inp: React.CSSProperties = { height: 40, padding: "0 12px", border: "1px solid var(--grey-200)", borderRadius: 8, font: "inherit" };
const card: React.CSSProperties = { border: "1.5px solid var(--grey-100)", borderRadius: 12, padding: 14 };
const h3: React.CSSProperties = { fontSize: 17, fontWeight: 700, margin: "28px 0 8px" };
const tbl: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: 14, fontVariantNumeric: "tabular-nums" };
const th: React.CSSProperties = { textAlign: "left", padding: "8px 6px", borderBottom: "1.5px solid var(--grey-200)", fontWeight: 600, whiteSpace: "nowrap" };
const thr: React.CSSProperties = { ...th, textAlign: "right" };
const td: React.CSSProperties = { padding: "8px 6px", borderBottom: "1px solid var(--grey-100)", verticalAlign: "top" };
const tdr: React.CSSProperties = { ...td, textAlign: "right" };
