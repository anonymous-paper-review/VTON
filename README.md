# VTON

현장 QR로 들어와 셀카 한 장으로 영상 속 주인공을 바꾸는 모바일 웹앱. Tale-Studio가 만든 영상을 입력으로 받아 fal.ai 교체 엔진으로 처리한다.

## 흐름

1. QR 스캔 → 영상 목록 (`/`)
2. 영상 선택 → "얼굴 바꾸기 해볼까요?" (`/v/[id]`)
3. 개인정보 수집·이용, 국외 이전(fal.ai) 동의
4. 셀카 촬영 (카메라가 안 열리면 사진 선택으로 대체)
5. 서버가 fal에 작업 등록 → 상태 조회 → 결과 영상 재생·저장

현장에 붙일 QR은 `/qr`에서 출력한다.

## 실행

```bash
npm install
cp .env.example .env.local   # FAL_KEY 등 채우기
npm run dev
```

`VTON_MOCK=1`이면 fal을 부르지 않고 몇 초 뒤 원본 영상을 결과로 돌려준다. 화면 흐름 확인용.

Claude 클라우드 환경처럼 프록시가 fal 인증 헤더를 넣어 주는 곳에서는 `FAL_KEY` 없이 `NODE_USE_ENV_PROXY=1 npm start`로 띄운다 (Node 내장 fetch는 이 설정 없이는 `HTTPS_PROXY`를 무시한다). 이때 fal이 원본 영상을 받아갈 수 있도록 `videos.json`의 `src`를 공개 URL로 바꿔야 한다.

## 설정

| 변수 | 설명 |
| --- | --- |
| `FAL_KEY` | fal API 키. 서버에서만 쓴다. |
| `VTON_ENGINE` | `minimax-h3`(기본) · `kling-o3` · `kling-o1` · `wan` |
| `VTON_MOCK` | `1`이면 모의 모드 |
| `NEXT_PUBLIC_SITE_URL` | QR에 넣을 배포 주소 |

## 영상 추가

`data/videos.json`에 항목을 넣는다. `src`는 fal이 받아갈 수 있는 공개 URL이어야 한다 (`/public` 경로는 배포 주소 기준으로 바뀐다). `cast`에는 고를 수 있는 인물을 화면 왼쪽부터 순서대로 넣는다. `target`은 프롬프트에서 그 인물을 특정하는 말(예: `"the woman in the red coat"`), `still`은 원본 속 그 인물의 얼굴 사진이다. 오른쪽 인물을 바꿀 때 왼쪽 인물들을 그대로 두려고 MiniMax에 함께 넣으므로, 맨 오른쪽이 아닌 인물에는 `still`이 필요하다. 인물이 둘 이상이면 "남자 주인공 되기"처럼 고르는 버튼이 나온다. 영상은 휴대폰에서 바로 재생되도록 720p H.264, faststart로 넣는다 (예: `ffmpeg -i in.mp4 -vf scale=-2:720 -c:v libx264 -crf 23 -movflags +faststart -c:a aac out.mp4`). 지금 들어 있는 `rain-alley`는 엔진 실험용으로 생성한 가상 인물 영상이다.

## 엔진

2026-10-21 2차 비교 기준 MiniMax H3 Max Recast(1080P)가 기본이다. 닮음 점수가 가장 높고 3분 정도 걸리지만 초당 $0.45로 Kling O3(약 $0.168)의 2.5배라, 비용을 줄일 땐 `VTON_ENGINE=kling-o3`로 바꾼다. 셀카 1장으로 충분해서 캐릭터시트 단계는 두지 않았다. Kling O3가 가끔 원본과 거의 같은 영상을 돌려주므로, 브라우저에서 원본 대비 PSNR이 35dB를 넘으면 같은 셀카로 한 번 자동 재시도한다 (`lib/frameCheck.ts`). 실험 보고서는 프로젝트 파일 `vton/experiment/out/2026-10-21-jdrama/REPORT.md`.

## 배포 (Vercel)

1. Vercel에서 이 저장소를 Import (Framework: Next.js, 설정 변경 없음)
2. Environment Variables에 `FAL_KEY`, `NEXT_PUBLIC_SITE_URL`(배포 주소) 추가. 엔진을 바꿀 땐 `VTON_ENGINE`
3. 배포 후 `/qr`을 열어 인쇄

fal이 원본 영상을 `https://<배포 주소>/videos/...`에서 받아가므로 배포 주소가 공개되어 있어야 한다 (Vercel 비밀번호 보호를 켜면 fal이 영상을 못 받는다).

## 남은 일

- 동의 기록·24시간 삭제를 DB(Supabase)와 예약 작업으로 옮기기 (지금은 서버 로그에만 남김)
- 동의 문구 법무 검토
- 목소리 교체
