// 단계별 결과를 Vercel 로그에 한 줄씩 남기고("vton event"), 이용 통계 DB(Supabase vton_events)에도 쌓는다.
// 관광공사 보고용 숫자(진입·영상 재생·생성 시도 사용자 수)를 /admin/stats 에서 본다.
// 사진·개인 식별 정보는 보내지 않는다. 사람 구분은 이 기기에서 만든 무작위 id(device)뿐이다.
// 실패해도 화면에는 영향이 없다.

export type TrackEvent =
  | "visit" // 앱 진입 (페이지를 새로 열 때마다. path, src: 들어온 길)
  | "view" // 장면 페이지 열람 = 영상 재생 (video)
  | "attempt" // 「주인공 되기」를 누름 = 생성 시도 (video, open: 생성이 열려 있었는지)
  | "consented" // 개인정보 동의 마침 (video)
  | "saved" // 결과 영상 저장·공유 (job, how)
  | "photo_check" // 휴대폰 안 사진 점검 결과 (issue, 사용자가 그래도 썼는지)
  | "submitted" // 사진 접수 (s: 보내는 데 걸린 초)
  | "submit_failed" // 접수 실패 (code)
  | "fitted" // 장면 의상(캐릭터시트) 완성 (s: 사진 보낸 뒤 걸린 초)
  | "fit_skipped" // 캐릭터시트 실패 → 사진 그대로 진행
  | "started" // fal이 만들기 시작 (s: 대기열에서 기다린 초)
  | "generated" // 생성 완료 (s: 만드는 데 걸린 초)
  | "downloaded" // 결과 영상 받음 (s, mb)
  | "download_failed" // 결과 영상 못 받음 (새 탭으로 넘김)
  | "noop_retry" // 원본 그대로라 한 번 더 만듦
  | "failed" // 생성 실패 (code, stage)
  | "net_weak"; // 상태 조회가 연달아 실패 (사용자 인터넷)

export function track(e: TrackEvent, data: Record<string, string | number | boolean | null | undefined> = {}) {
  try {
    // 검색 로봇·자동 점검 브라우저(배포 직후 미리보기 촬영 등)는 사람이 아니므로 세지 않는다
    if (!botsAllowed() && (navigator.webdriver || /bot|crawl|spider|slurp|headless|lighthouse|vercel|preview|facebookexternalhit|embedly|kakaotalk-scrap/i.test(navigator.userAgent))) return;
    const body = JSON.stringify({ e, env: browserEnv(), device: deviceId(), lang: document.documentElement.lang || undefined, ...data });
    if (navigator.sendBeacon?.("/api/log", new Blob([body], { type: "application/json" }))) return;
    fetch("/api/log", { method: "POST", body, keepalive: true, headers: { "content-type": "application/json" } }).catch(() => {});
  } catch {}
}

/** 기기·앱 안 브라우저 구분 (카카오톡·네이버 등 앱 안 브라우저는 저장·카메라가 막히는 일이 있어 따로 본다) */
function browserEnv() {
  const ua = navigator.userAgent;
  const os = /iPhone|iPad|iPod/.test(ua) ? "ios" : /Android/.test(ua) ? "android" : "other";
  const app = /KAKAOTALK/i.test(ua) ? "kakao" : /NAVER/.test(ua) ? "naver" : /Instagram|FBAN|FBAV/.test(ua) ? "meta" : /Line\//.test(ua) ? "line" : /MicroMessenger/.test(ua) ? "wechat" : "";
  return app ? `${os}-${app}` : os;
}

const DEVICE_KEY = "vton.did";
/** 이 기기의 익명 무작위 id (사용자 수를 세는 데만 쓴다). 저장이 막힌 브라우저는 페이지마다 새로 만든다. */
let memId: string | null = null;
function deviceId() {
  try {
    const v = localStorage.getItem(DEVICE_KEY);
    if (v) return v;
  } catch {}
  memId ??= (crypto.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`);
  try { localStorage.setItem(DEVICE_KEY, memId); } catch {}
  return memId;
}

/** 들어온 길: 지도 앱(AI관광집사)에서 ?return= 으로 / 다른 사이트 링크 / 그 밖(QR 스캔·주소 직접 입력) */
export function entrySource(): string {
  const q = new URLSearchParams(location.search);
  if (q.get("return") || q.get("back")) return "map";
  const given = q.get("src") ?? q.get("utm_source");
  if (given) return given.slice(0, 16);
  try {
    if (document.referrer) {
      const h = new URL(document.referrer).hostname;
      if (h !== location.hostname) return h.includes("traveljipsa") ? "map" : "link";
    }
  } catch {}
  return "direct";
}

/** e2e/bot.js 점검 봇만 켠다 */
function botsAllowed() {
  try { return localStorage.getItem("vton.trackBots") === "1"; } catch { return false; }
}
