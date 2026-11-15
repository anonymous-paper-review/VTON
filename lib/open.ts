// 영상 생성(얼굴 바꾸기) 공개 여부. 정식 서비스 전에는 꺼 둔다.
// 켜려면 Vercel 환경변수 NEXT_PUBLIC_GENERATION_OPEN=1 을 넣고 Redeploy.
// 꺼져 있으면 목록·장면 미리보기는 그대로 보이고, 「주인공 되기」를 누르면 "준비 중" 안내만 뜬다.
// 서버(/api/jobs)도 같은 값으로 막아서, 주소를 직접 불러도 fal 요금이 나가지 않는다.
export const GENERATION_OPEN = process.env.NEXT_PUBLIC_GENERATION_OPEN === "1";
