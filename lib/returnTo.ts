// AI관광집사 같은 다른 앱이 우리 주소를 열어 줄 때, 돌아갈 주소를 ?return= 으로 넘긴다.
// 지도의 "지금 보던 화면"으로 돌아오려면 그 화면의 전체 주소(경로·쿼리·# 포함)를 encodeURIComponent 해서 넘긴다.
// 예: https://<우리 주소>/?return=https%3A%2F%2Fmap.traveljipsa.com%2Fspot%2F12%3Ftab%3Dinfo%23pin
// 받은 주소는 이 기기에 하루 동안 기억해, 영상 만드는 중 앱을 닫았다 다시 와도 버튼이 남는다.
// return이 없으면 다른 사이트에서 링크로 들어온 경우 그 사이트(referrer)로 돌아간다.
// 그것도 없으면(QR로 바로 들어온 경우 등) 협업사 지도 서비스 기본 주소로 돌아간다.
// 기본 주소는 NEXT_PUBLIC_MAP_URL로 바꿀 수 있고, 빈 값("")이면 버튼을 숨긴다.
//
// ?return= 은 협업사 주소만 받는다(아무 사이트로나 보내는 링크로 악용되지 않게).
// 허용: *.traveljipsa.com, 기본 지도 주소의 호스트, NEXT_PUBLIC_RETURN_HOSTS(쉼표로 구분, ".a.com"은 하위 도메인 포함).
//
// 버튼을 누르면, 지도에서 이 탭으로 바로 들어온 경우엔 브라우저 "뒤로 가기"로 지도까지 되돌아간다
// (지도가 보던 화면·스크롤·열어 둔 상태를 그대로 되살린다). 그럴 수 없으면 return 주소로 이동한다.

const DEFAULT_MAP_URL = process.env.NEXT_PUBLIC_MAP_URL ?? "http://43.202.119.216/";

const KEY = "vton.return";
const LANDING_KEY = "vton.landing"; // 이 탭에서 지도에서 들어왔는지(sessionStorage)
const TTL_MS = 24 * 60 * 60 * 1000;

function allowedHosts(): string[] {
  const hosts = [".traveljipsa.com", "43.202.119.216"];
  try { if (DEFAULT_MAP_URL) hosts.push(new URL(DEFAULT_MAP_URL).hostname); } catch {}
  for (const h of (process.env.NEXT_PUBLIC_RETURN_HOSTS ?? "").split(",")) if (h.trim()) hosts.push(h.trim().toLowerCase());
  return hosts;
}

function hostAllowed(host: string): boolean {
  host = host.toLowerCase();
  return allowedHosts().some((h) => (h.startsWith(".") ? host === h.slice(1) || host.endsWith(h) : host === h));
}

/** http(s) 주소만 받는다 (javascript: 같은 주소로 버튼이 악용되지 않게) */
function safe(u: string | null | undefined, partnerOnly = false): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (partnerOnly && !hostAllowed(url.hostname)) return null;
    return url.href;
  } catch {
    return null;
  }
}

/**
 * ?return= 값을 꺼낸다. 협업사가 인코딩을 빠뜨려 `?return=https://x/a?b=1&c=2#h` 처럼 넘겨도
 * 뒤의 &c=2 와 #h 가 우리 주소 쪽으로 떨어져 나가지 않게, return= 뒤를 통째로 주소로 본다(우리 파라미터 lang·job은 제외).
 */
function givenReturn(): string | null {
  const m = location.search.match(/[?&](?:return|back)=(.*)$/);
  if (!m) return null;
  if (/^https?%3A/i.test(m[1])) return new URLSearchParams(location.search).get("return") ?? new URLSearchParams(location.search).get("back"); // 제대로 인코딩됨
  // 인코딩 안 됨: return= 뒤 전부(우리 파라미터 제외) + 우리 주소로 떨어진 # 까지 붙여 원래 주소를 되살린다
  const rest = m[1].split("&").filter((p) => !/^(lang|job)=/.test(p)).join("&");
  return decodeURI(rest) + location.hash;
}

export function readReturnUrl(): string | null {
  let given: string | null = null;
  try { given = safe(givenReturn(), true); } catch {}
  if (given) {
    try { localStorage.setItem(KEY, JSON.stringify({ url: given, at: Date.now() })); } catch {}
    // 지도에서 링크로 이 탭에 들어왔다면, 그 사실을 적어 둔다 → 나중에 뒤로 가기로 지도 화면을 그대로 되살린다.
    // 조건: 이 탭의 우리 기록 맨 앞(index 0)이고, 그 앞에 다른 사이트 기록이 있으며, referrer가 비었거나 협업사.
    // (https 지도 → http 주소처럼 referrer가 빠지는 경우가 있어 빈 값도 받는다)
    try {
      const nav = (window as unknown as { navigation?: { currentEntry?: { index: number }; entries(): unknown[] } }).navigation;
      const ref = document.referrer ? new URL(document.referrer) : null;
      const fromPartner = !ref || (ref.origin !== location.origin && hostAllowed(ref.hostname));
      if (nav?.currentEntry && nav.currentEntry.index === 0 && history.length > nav.entries().length && fromPartner) {
        sessionStorage.setItem(LANDING_KEY, JSON.stringify({ url: given }));
      } else if (nav?.currentEntry?.index === 0) {
        sessionStorage.removeItem(LANDING_KEY);
      }
    } catch {}
    return given;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { url: string; at: number } | null;
    if (saved && Date.now() - saved.at < TTL_MS && safe(saved.url, true)) return saved.url;
  } catch {}
  const ref = safe(document.referrer);
  if (ref && new URL(ref).origin !== location.origin) return ref;
  return safe(DEFAULT_MAP_URL);
}

/**
 * 지도 버튼 클릭: 이 탭이 지도에서 바로 넘어온 경우 history.go(-n)으로 지도 화면까지 되돌린다.
 * 안 되는 브라우저(Navigation API 없음)·새 탭으로 열린 경우엔 링크(href) 그대로 이동한다.
 */
export function goBackToMap(e: { preventDefault(): void }, url: string) {
  try {
    const landing = JSON.parse(sessionStorage.getItem(LANDING_KEY) ?? "null") as { url: string } | null;
    const nav = (window as unknown as { navigation?: { currentEntry?: { index: number } } }).navigation;
    if (!landing || landing.url !== url || !nav?.currentEntry) return;
    const steps = nav.currentEntry.index + 1; // 우리 기록 맨 앞(index 0) 바로 앞이 지도
    e.preventDefault();
    let left = false;
    const onHide = () => { left = true; };
    addEventListener("pagehide", onHide, { once: true });
    history.go(-steps);
    // 뒤로 가기가 먹지 않으면(기록이 지워졌거나 막힘) 주소로 이동
    setTimeout(() => { removeEventListener("pagehide", onHide); if (!left && !document.hidden) location.href = url; }, 800);
  } catch {}
}
