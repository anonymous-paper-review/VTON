# VTON

현장 QR로 들어와 셀카 한 장으로 영상 속 주인공을 바꾸는 모바일 웹앱. Tale-Studio가 만든 영상을 입력으로 받아 fal.ai 교체 엔진으로 처리한다.

## 흐름

1. QR 스캔 → 영상 목록 (`/`)
2. 영상 선택 → "얼굴 바꾸기 해볼까요?" (`/v/[id]`)
3. 개인정보 수집·이용, 국외 이전(fal.ai) 동의
4. 셀카 촬영 (카메라가 안 열리면 사진 선택으로 대체)
5. 서버가 fal에 작업 등록 → 상태 조회 → 결과 영상 재생·저장

현장에 붙일 QR은 `/qr`에서 출력한다 (4개 국어 안내가 들어간 포스터).

화면은 한국어·중국어·영어·일본어로 바뀐다. 처음엔 브라우저 언어를 따르고, 상단 `한 中 EN 日` 버튼으로 고르면 기억한다. `?lang=en`처럼 링크로 고정할 수도 있다. 문구는 `lib/i18n.ts`, 동의서는 `lib/consent.ts`에 있고, 키를 더하면 네 언어를 모두 채운다.

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

`data/videos.json`에 항목을 넣는다. `src`는 fal이 받아갈 수 있는 공개 URL이어야 한다 (`/public` 경로는 배포 주소 기준으로 바뀐다). `cast`에는 고를 수 있는 인물을 화면 왼쪽부터 순서대로 넣는다. `target`은 프롬프트에서 그 인물을 특정하는 말(예: `"the woman in the red coat"`), `still`은 원본 속 그 인물의 얼굴 사진, `photo`는 고르는 타일에 보일 인물 사진이다. `title`, `description`, `label`은 `{ko, zh, en, ja}`로 네 언어를 넣는다. 오른쪽 인물을 바꿀 때 왼쪽 인물들을 그대로 두려고 MiniMax에 함께 넣으므로, 맨 오른쪽이 아닌 인물에는 `still`이 필요하다. 인물이 둘 이상이면 인물 사진 타일로 고르게 된다. 영상은 휴대폰에서 바로 재생되도록 720p(세로면 720x1280) H.264, faststart로 넣는다 (예: `ffmpeg -i in.mp4 -vf scale=-2:720 -c:v libx264 -crf 23 -movflags +faststart -c:a aac out.mp4`). 지금 들어 있는 `simni-walk`, `simni-petal`, `simni-stream`은 화개장터 앞 십리벚꽃길과 화개천을 배경으로 생성한 가상 인물 데모 영상이다 (9:16 세로, 마지막 2초 카메라 응시, 키프레임 nano-banana-pro → Veo 3.1 image-to-video). 영상은 가로든 세로든 자르지 않고 원래 비율로 보여 준다. 실제 촬영 영상이 생기면 교체한다.

## 엔진

2026-10-21 2차 비교 기준 MiniMax H3 Max Recast가 기본이다 (실험은 1080P, 앱은 768P로 만든다). 닮음 점수가 가장 높고 3분 정도 걸리지만 768P도 초당 $0.30으로 Kling O3(약 $0.168)의 1.8배라, 비용을 줄일 땐 `VTON_ENGINE=kling-o3`로 바꾼다. 셀카 1장으로 충분해서 캐릭터시트 단계는 두지 않았다. Kling O3가 가끔 원본과 거의 같은 영상을 돌려주므로, 브라우저에서 원본 대비 PSNR이 35dB를 넘으면 같은 셀카로 한 번 자동 재시도한다 (`lib/frameCheck.ts`). 실험 보고서는 프로젝트 파일 `vton/experiment/out/2026-10-21-jdrama/REPORT.md`.

## 배포 (Vercel)

1. vercel.com에 로그인 → **Add New… → Project** → GitHub의 `anonymous-paper-review/VTON` **Import**
   (목록에 없으면 "Adjust GitHub App Permissions"에서 이 저장소를 허용)
2. Framework는 Next.js로 자동 인식된다. Build·Output 설정은 그대로 둔다.
3. **Environment Variables**에 추가 후 **Deploy**
   - `FAL_KEY`: fal 대시보드(fal.ai/dashboard/keys)에서 만든 키
   - `VTON_ENGINE`: 비워 두면 `minimax-h3`. 비용을 줄이려면 `kling-o3`
4. 배포가 끝나면 나오는 `https://<프로젝트>.vercel.app` 주소를 `NEXT_PUBLIC_SITE_URL`로 넣고 **Redeploy** (QR에 들어갈 주소 고정)
5. `https://<프로젝트>.vercel.app/qr`을 열어 인쇄하거나 캡처해서 현장에 붙인다.

참고
- 영상 생성은 fal 큐에서 따로 돌고 서버 함수는 등록·조회만 하므로(몇 초), 함수 실행 시간이나 리전 설정은 바꿀 필요가 없다.
- 운영 주소(Production)는 공개 상태여야 한다. fal이 `https://<주소>/videos/...`에서 원본 영상을 받아간다. Vercel 기본 설정(Standard Protection)은 프리뷰 주소만 막으므로 그대로 두면 된다.
- 자기 도메인을 쓰려면 Project → Settings → Domains에서 추가하고, `NEXT_PUBLIC_SITE_URL`도 그 주소로 바꾼 뒤 Redeploy.
- QR만 있으면 누구나 생성을 돌릴 수 있으니 fal 대시보드에서 사용 한도(Usage limit)를 걸어 두는 게 안전하다. MiniMax 768P 기준 8초 영상 한 편에 약 $2.4 (무변화 자동 재시도가 붙으면 그 두 배).
- Vercel Hobby(무료) 요금제는 비상업 개인 용도 조건이 있어, 회사 실증이면 Pro를 검토한다.

## 남은 일

- 동의 기록을 DB(Supabase)에 남기기 (지금은 서버 로그에만 남김)
- 정식 서비스로 넘어갈 때 동의 문구 법무 검토
- 목소리 교체
