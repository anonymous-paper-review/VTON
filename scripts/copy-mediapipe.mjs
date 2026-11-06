// 얼굴 점검(MediaPipe)의 wasm 파일을 public/mediapipe/로 복사한다. 저장소엔 넣지 않고(약 19MB) 설치 때마다 만든다.
// 외부 CDN을 쓰지 않는 이유: 현장(특히 중국 방문객) 망에서 CDN이 막히거나 느릴 수 있어서.
import { cpSync, existsSync, mkdirSync } from "node:fs";
const src = "node_modules/@mediapipe/tasks-vision/wasm";
if (existsSync(src)) {
  mkdirSync("public/mediapipe", { recursive: true });
  cpSync(src, "public/mediapipe", { recursive: true });
}
