// AI관광집사 같은 다른 앱이 우리 주소를 열어 줄 때, 돌아갈 주소를 ?return= 으로 넘긴다.
// 예: https://<우리 주소>/?return=https%3A%2F%2Fmap.example.com%2Fspot%2F12
// 받은 주소는 이 기기에 하루 동안 기억해, 영상 만드는 중 앱을 닫았다 다시 와도 버튼이 남는다.
// return이 없으면 다른 사이트에서 링크로 들어온 경우 그 사이트(referrer)로 돌아간다.

const KEY = "vton.return";
const TTL_MS = 24 * 60 * 60 * 1000;

/** http(s) 주소만 받는다 (javascript: 같은 주소로 버튼이 악용되지 않게) */
function safe(u: string | null | undefined): string | null {
  if (!u) return null;
  try {
    const url = new URL(u);
    return url.protocol === "https:" || url.protocol === "http:" ? url.href : null;
  } catch {
    return null;
  }
}

export function readReturnUrl(): string | null {
  const q = new URLSearchParams(location.search);
  const given = safe(q.get("return") ?? q.get("back"));
  if (given) {
    try { localStorage.setItem(KEY, JSON.stringify({ url: given, at: Date.now() })); } catch {}
    return given;
  }
  try {
    const saved = JSON.parse(localStorage.getItem(KEY) ?? "null") as { url: string; at: number } | null;
    if (saved && Date.now() - saved.at < TTL_MS && safe(saved.url)) return saved.url;
  } catch {}
  const ref = safe(document.referrer);
  return ref && new URL(ref).origin !== location.origin ? ref : null;
}
