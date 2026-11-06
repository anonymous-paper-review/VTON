// 셀카를 보내기 전에 휴대폰 안에서 사진을 점검한다 (무료, 1초 안쪽).
// fal에 보낸 뒤 「얼굴 없음」으로 실패하면 이미 몇 분과 요금이 나간 뒤라, 걸러낼 수 있는 것은 여기서 거른다.
// 얼굴 찾기는 MediaPipe BlazeFace(셀카 거리용, 약 230KB) + wasm(public/mediapipe, scripts/copy-mediapipe.mjs).
// 점검기가 못 뜨거나 늦으면 점검 없이 그대로 보낸다. 점검은 돕는 것이지 막는 것이 아니다.
import type { FaceDetector } from "@mediapipe/tasks-vision";

export type PhotoIssue = "noFace" | "many" | "small" | "side" | "dark" | "blur";
export type PhotoCheck = { issue: PhotoIssue | null; skipped?: boolean; m?: Record<string, number> };

// 기준값. 정상 셀카가 걸리지 않게 느슨하게 잡았다. 표본(2026-11-06): 정상 얼굴 밝기 135~140·선명도 196~2562,
// 밝기 25%로 어둡게 한 사진 33~34, 가우시안 흐림 2.5px 15~17·6px 3~5, 얼굴 너비 정상 셀카 0.20~0.45.
// 걸려도 「그래도 이 사진으로」를 누를 수 있다.
const MIN_FACE_W = 0.12; // 얼굴 너비 / 사진 너비. 이보다 작으면 멀리서 찍은 것
const MAX_YAW = 0.5; // (코 - 두 눈 가운데) / 눈 사이 거리. 이보다 크면 옆을 본 것
const MIN_LUMA = 55; // 얼굴 부분 평균 밝기(0~255)
const MIN_SHARP = 15; // 얼굴 부분 라플라시안 분산(128px로 줄여서). 이보다 작으면 흔들림·초점 나감
const OTHER_FACE = 0.45; // 가장 큰 얼굴 대비 이만큼 넘는 얼굴이 또 있으면 여러 명

let detector: Promise<FaceDetector | null> | null = null;

/** 셀카 화면에 들어오면 미리 불러 둔다 (wasm 약 3MB, 압축 기준) */
export function preloadFaceCheck() {
  detector ??= (async () => {
    try {
      const { FilesetResolver, FaceDetector } = await import("@mediapipe/tasks-vision");
      const files = await FilesetResolver.forVisionTasks("/mediapipe");
      return await FaceDetector.createFromOptions(files, {
        baseOptions: { modelAssetPath: "/models/blaze_face_short_range.tflite", delegate: "CPU" },
        runningMode: "IMAGE",
        minDetectionConfidence: 0.5,
      });
    } catch (e) {
      console.warn("face check unavailable", e);
      return null;
    }
  })();
  return detector;
}

const later = <T,>(ms: number, v: T) => new Promise<T>((r) => setTimeout(() => r(v), ms));

export async function checkPhoto(blob: Blob, waitMs = 5000): Promise<PhotoCheck> {
  const det = await Promise.race([preloadFaceCheck(), later(waitMs, null)]);
  if (!det) return { issue: null, skipped: true };
  try {
    const bmp = await createImageBitmap(blob);
    const W = bmp.width, H = bmp.height;
    const faces = det.detect(bmp).detections
      .map((d) => ({ box: d.boundingBox!, kp: d.keypoints }))
      .filter((f) => f.box)
      .sort((a, b) => b.box.width * b.box.height - a.box.width * a.box.height);
    if (!faces.length) return { issue: "noFace" };
    const main = faces[0];
    const area = main.box.width * main.box.height;
    const m: Record<string, number> = { faces: faces.length, w: main.box.width / W };
    if (faces.slice(1).some((f) => f.box.width * f.box.height > area * OTHER_FACE)) return { issue: "many", m };
    if (m.w < MIN_FACE_W) return { issue: "small", m };
    // 키포인트: 0 오른눈, 1 왼눈, 2 코끝 (0~1 정규화)
    const [re, le, nose] = main.kp;
    if (re && le && nose) {
      const eyeD = Math.hypot(le.x - re.x, le.y - re.y);
      m.yaw = eyeD > 0 ? Math.abs(nose.x - (re.x + le.x) / 2) / eyeD : 0;
      if (m.yaw > MAX_YAW) return { issue: "side", m };
    }
    const { luma, sharp } = faceStats(bmp, main.box);
    m.luma = luma; m.sharp = sharp;
    if (luma < MIN_LUMA) return { issue: "dark", m };
    if (sharp < MIN_SHARP) return { issue: "blur", m };
    return { issue: null, m };
  } catch (e) {
    console.warn("face check failed", e);
    return { issue: null, skipped: true };
  }
}

/** 얼굴 상자를 128px 회색조로 줄여 평균 밝기와 라플라시안 분산(선명도)을 잰다 */
function faceStats(img: ImageBitmap, box: { originX: number; originY: number; width: number; height: number }) {
  const S = 128;
  const c = document.createElement("canvas");
  c.width = S; c.height = S;
  const ctx = c.getContext("2d", { willReadFrequently: true })!;
  ctx.drawImage(img, box.originX, box.originY, box.width, box.height, 0, 0, S, S);
  const d = ctx.getImageData(0, 0, S, S).data;
  const g = new Float32Array(S * S);
  let sum = 0;
  for (let i = 0; i < S * S; i++) { g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]; sum += g[i]; }
  let ls = 0, ls2 = 0, n = 0;
  for (let y = 1; y < S - 1; y++) for (let x = 1; x < S - 1; x++) {
    const i = y * S + x;
    const l = g[i - S] + g[i + S] + g[i - 1] + g[i + 1] - 4 * g[i];
    ls += l; ls2 += l * l; n++;
  }
  const mean = ls / n;
  return { luma: sum / (S * S), sharp: ls2 / n - mean * mean };
}
