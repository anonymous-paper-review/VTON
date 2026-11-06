// 결과 영상이 원본과 사실상 같은지(엔진이 성공 응답만 하고 아무것도 안 바꾼 경우) 브라우저에서 확인한다.
// 엔진 비교 실험에서 정상 교체 결과는 원본 대비 PSNR 21~27dB, 아무것도 안 바뀐 결과는 43~45dB였다.

export const NOOP_PSNR_DB = 35;

const W = 160;
const H = 90;
const SAMPLES = 6;
// 휴대폰(특히 iOS Safari)은 화면에 붙이지 않은 영상을 재생 전까지 받지 않아 loadeddata·seeked가 끝내 오지 않을 수 있다.
// 그러면 「확인 중」에서 영원히 멈추고 조회 루프의 시간 제한도 돌지 않으므로, 확인은 이 시간 안에 못 끝내면 건너뛴다.
export const CHECK_TIMEOUT_MS = 20_000;

function load(src: string, made: HTMLVideoElement[]): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    made.push(v);
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("영상 로드 실패"));
    v.src = src;
    v.load();
  });
}

function seek(v: HTMLVideoElement, t: number): Promise<void> {
  return new Promise((resolve) => {
    v.onseeked = () => resolve();
    v.currentTime = t;
  });
}

function pixels(v: HTMLVideoElement, ctx: CanvasRenderingContext2D) {
  ctx.drawImage(v, 0, 0, W, H);
  return ctx.getImageData(0, 0, W, H).data;
}

/** 원본과 결과의 평균 PSNR(dB). 영상을 읽을 수 없거나(CORS 등) 제한 시간 안에 못 끝내면 null. */
export async function psnrAgainstSource(sourceUrl: string, resultUrl: string, timeoutMs = CHECK_TIMEOUT_MS): Promise<number | null> {
  const videos: HTMLVideoElement[] = [];
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<null>((resolve) => { timer = setTimeout(() => resolve(null), timeoutMs); });
  try {
    return await Promise.race([measure(sourceUrl, resultUrl, videos), timeout]);
  } finally {
    clearTimeout(timer);
    // 늦게 끝난 로드가 휴대폰 데이터를 계속 쓰지 않게 끊는다
    for (const v of videos) { v.removeAttribute("src"); v.load(); }
  }
}

async function measure(sourceUrl: string, resultUrl: string, videos: HTMLVideoElement[]): Promise<number | null> {
  try {
    const [a, b] = await Promise.all([load(sourceUrl, videos), load(resultUrl, videos)]);
    const canvas = document.createElement("canvas");
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d", { willReadFrequently: true })!;
    const dur = Math.min(a.duration, b.duration);
    let se = 0;
    let n = 0;
    for (let i = 1; i <= SAMPLES; i++) {
      const t = (dur * i) / (SAMPLES + 1);
      await Promise.all([seek(a, t), seek(b, t)]);
      const pa = pixels(a, ctx);
      const pb = pixels(b, ctx);
      for (let p = 0; p < pa.length; p += 4) {
        for (let c = 0; c < 3; c++) {
          const d = pa[p + c] - pb[p + c];
          se += d * d;
        }
        n += 3;
      }
    }
    const mse = se / n;
    return mse === 0 ? Infinity : 10 * Math.log10((255 * 255) / mse);
  } catch {
    return null;
  }
}
