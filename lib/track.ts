// 단계별 결과를 Vercel 로그에 한 줄씩 남긴다 ("vton event"). 어디서 얼마나 실패하는지 숫자로 보려고.
// 사진·개인 식별 정보는 보내지 않는다. 실패해도 화면에는 영향이 없다.

export type TrackEvent =
  | "photo_check" // 휴대폰 안 사진 점검 결과 (issue, 사용자가 그래도 썼는지)
  | "submitted" // 사진 접수 (s: 보내는 데 걸린 초)
  | "submit_failed" // 접수 실패 (code)
  | "started" // fal이 만들기 시작 (s: 대기열에서 기다린 초)
  | "generated" // 생성 완료 (s: 만드는 데 걸린 초)
  | "downloaded" // 결과 영상 받음 (s, mb)
  | "download_failed" // 결과 영상 못 받음 (새 탭으로 넘김)
  | "noop_retry" // 원본 그대로라 한 번 더 만듦
  | "failed" // 생성 실패 (code, stage)
  | "net_weak"; // 상태 조회가 연달아 실패 (사용자 인터넷)

export function track(e: TrackEvent, data: Record<string, string | number | boolean | null | undefined> = {}) {
  try {
    const body = JSON.stringify({ e, ...data, env: browserEnv() });
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
