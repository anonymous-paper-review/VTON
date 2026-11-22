// 영상 생성(얼굴 바꾸기) 공개 여부. 정식 오픈 시각(한국 시간 2026-11-30 0시, 오너 2026-11-22)이 되면 저절로 열린다.
// 꺼져 있으면 목록·장면 미리보기는 그대로 보이고, 「주인공 되기」를 누르면 "준비 중" 안내만 뜬다.
// 서버(/api/jobs)도 같은 함수로 막아서, 주소를 직접 불러도 오픈 전에는 fal 요금이 나가지 않는다.
// 바꾸기: NEXT_PUBLIC_GENERATION_OPEN=1 이면 지금 바로 열림, =0 이면 시각과 상관없이 잠금.
//         NEXT_PUBLIC_GENERATION_OPEN_AT=<ISO 시각> 으로 오픈 시각을 바꿀 수 있다. (빌드 때 들어가는 값이라 Redeploy 필요)
const FLAG = process.env.NEXT_PUBLIC_GENERATION_OPEN;
export const GENERATION_OPEN_AT = Date.parse(process.env.NEXT_PUBLIC_GENERATION_OPEN_AT || "2026-11-30T00:00:00+09:00");

/** 지금 생성이 열려 있는지. 누를 때마다(요청마다) 시각을 다시 본다. */
export function isGenerationOpen(now = Date.now()) {
  if (FLAG === "1") return true;
  if (FLAG === "0") return false;
  return Number.isFinite(GENERATION_OPEN_AT) && now >= GENERATION_OPEN_AT;
}
