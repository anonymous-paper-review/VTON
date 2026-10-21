// 결과 영상이 원본과 사실상 같은지(엔진이 성공 응답만 하고 아무것도 안 바꾼 경우) 브라우저에서 확인한다.
// 엔진 비교 실험에서 정상 교체 결과는 원본 대비 PSNR 21~27dB, 아무것도 안 바뀐 결과는 43~45dB였다.

export const NOOP_PSNR_DB = 35;

const W = 160;
const H = 90;
const SAMPLES = 6;

function load(src: string): Promise<HTMLVideoElement> {
  return new Promise((resolve, reject) => {
    const v = document.createElement("video");
    v.crossOrigin = "anonymous";
    v.muted = true;
    v.playsInline = true;
    v.preload = "auto";
    v.onloadeddata = () => resolve(v);
    v.onerror = () => reject(new Error("영상 로드 실패"));
    v.src = src;
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

/** 원본과 결과의 평균 PSNR(dB). 영상을 읽을 수 없으면(CORS 등) null. */
export async function psnrAgainstSource(sourceUrl: string, resultUrl: string): Promise<number | null> {
  try {
    const [a, b] = await Promise.all([load(sourceUrl), load(resultUrl)]);
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
