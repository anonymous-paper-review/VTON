import "server-only";

// 이용 통계 DB: Supabase(테일스튜디오 tale-dev 프로젝트)의 public.vton_events 표.
// 표는 직접 못 읽고 쓴다(RLS). 쓰기는 vton_log(), 읽기는 비밀번호를 확인하는 vton_stats() 함수로만 한다.
// 그래서 키는 공개용(publishable) 키로 충분하다. 환경변수가 없으면(미리보기·로컬) 아무것도 안 쌓는다.
const URL_ = process.env.VTON_STATS_URL;
const KEY = process.env.VTON_STATS_KEY;

export const statsEnabled = !!(URL_ && KEY);

async function rpc(fn: string, body: unknown) {
  return fetch(`${URL_}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { apikey: KEY!, authorization: `Bearer ${KEY}`, "content-type": "application/json" },
    body: JSON.stringify(body),
    cache: "no-store",
    signal: AbortSignal.timeout(5000),
  });
}

const TOP = new Set(["device", "video", "lang", "env", "src"]);

export async function recordEvent(out: Record<string, unknown>) {
  if (!statsEnabled) return;
  const p: Record<string, unknown> = { e: out.e };
  const data: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(out)) {
    if (k === "e") continue;
    if (TOP.has(k)) p[k] = v;
    else data[k] = v;
  }
  if (Object.keys(data).length) p.data = data;
  try {
    const r = await rpc("vton_log", { p });
    if (!r.ok) console.warn("vton stats write failed", r.status);
  } catch (e) {
    console.warn("vton stats write failed", (e as Error).message);
  }
}

type Count = { n: number; u: number };
export type Stats = {
  totals: Record<string, Count>;
  daily: { d: string; visit: number; view: number; attempt: number; submitted: number; generated: number; saved: number }[];
  byVideo: { video: string; view: number; attempt: number; submitted: number }[];
  byLang: Record<string, number>;
  byEnv: Record<string, number>;
  bySrc: Record<string, number>;
  returning: number;
  first: string | null;
};

/** 기간(서울 날짜, 양끝 포함) 통계. 비밀번호가 틀리면 "denied". */
export async function readStats(token: string, from: string, to: string): Promise<Stats | "denied" | "error"> {
  if (!statsEnabled) return "error";
  try {
    const r = await rpc("vton_stats", { p_token: token, p_from: from, p_to: to });
    if (r.status === 401 || r.status === 403) return "denied";
    if (!r.ok) {
      const t = await r.text();
      return t.includes("denied") ? "denied" : "error";
    }
    return (await r.json()) as Stats;
  } catch {
    return "error";
  }
}
