# VTON

현장 QR로 들어와 셀카 한 장으로 영상 속 주인공을 바꾸는 모바일 웹앱. Tale-Studio가 만든 영상을 입력으로 받아 fal.ai 교체 엔진으로 처리한다.

## 흐름

1. QR 스캔 → 영상 목록 (`/`)
2. 영상 선택 → "얼굴 바꾸기 해볼까요?" (`/v/[id]`)
3. 개인정보 수집·이용, 국외 이전(fal.ai) 동의
4. 셀카 촬영 (카메라가 안 열리면 사진 선택으로 대체)
5. 서버가 장면 의상을 입힌 캐릭터시트를 만들고 fal에 얼굴 구간만 작업 등록 → 상태 조회 → 원본 샷을 이어 붙인 결과 영상 재생·저장

만드는 화면의 단계 표시(사진 접수 → 장면 의상 입히기 → AI 영상 만들기 → 내 휴대폰으로 받기)는 실제로 끝난 일에 맞춰 넘어간다. `/api/jobs`가 응답을 한 줄씩 흘려보내(사진 받음 → 캐릭터시트 완성 또는 실패 → 엔진 접수) 화면이 그때마다 완료 표시를 한다. 캐릭터시트가 실패하면 "사진 그대로 진행"이라고 알린다.

현장에 붙일 QR은 `/qr`에서 출력한다 (4개 국어 안내가 들어간 포스터).

화면은 한국어·중국어·영어·일본어로 바뀐다. 처음엔 브라우저 언어를 따르고, 상단 `한 中 EN 日` 버튼으로 고르면 기억한다. `?lang=en`처럼 링크로 고정할 수도 있다. 문구는 `lib/i18n.ts`, 동의서는 `lib/consent.ts`에 있고, 키를 더하면 네 언어를 모두 채운다.

## 다른 앱에서 들어오기

AI관광집사(지도 앱)처럼 다른 앱이 우리 주소를 열 때 `?return=<돌아갈 주소>`를 붙이면(URL 인코딩, http/https만), 홈 헤더 왼쪽(← 자리)에 검정 「지도」 버튼이 떠서 그 주소로 돌아간다. 완성 화면에도 같은 링크가 있다. 주소는 이 기기에 하루 기억하고, `return`이 없으면 다른 사이트에서 링크로 들어온 경우 그 사이트로, 그것도 없으면 협업사 지도 서비스 기본 주소(`http://43.202.119.216/`, `NEXT_PUBLIC_MAP_URL`로 변경 가능, 빈 값이면 버튼 숨김)로 돌아간다. 예: `https://<우리 주소>/?lang=en&return=https%3A%2F%2Fmap.example.com%2Fspot%2F12`

## 디자인

협업사 UI 가이드(AI관광집사, 2026-10-20)의 바탕값을 따른다. `app/tokens.css`는 받은 파일 그대로이고 화면은 그 변수만 쓴다(녹차 `#4E7A45` 주요 버튼 한 화면에 하나, 흰 바탕, Pretendard 500·600·700, 간격 4의 배수, 버튼 높이 44·모퉁이 8). 아이콘은 가이드가 준 Ant Design 세트(`app/icons.tsx`), Pretendard는 `public/fonts/pretendard`에 직접 싣는다. 값이 바뀌어 새 `tokens.css`를 받으면 그 파일만 바꾸면 된다.

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

`data/videos.json`에 항목을 넣는다. `src`는 fal이 받아갈 수 있는 공개 URL이어야 한다 (`/public` 경로는 배포 주소 기준으로 바뀐다). `cast`에는 고를 수 있는 인물을 화면 왼쪽부터 순서대로 넣는다. `target`은 프롬프트에서 그 인물을 특정하는 말(예: `"the woman in the red coat"`), `still`은 원본 속 그 인물의 얼굴 사진, `photo`는 고르는 타일에 보일 인물 사진이다. `title`, `description`, `label`은 `{ko, zh, en, ja}`로 네 언어를 넣는다. `group`은 목록 탭(장소)이다: `simni` 십리벚꽃길, `market` 화개장터, `tea` 녹차밭, `river` 섬진강. 맨 오른쪽이 아닌 인물(cast 배열에서 뒤에 다른 인물이 있는 인물)에는 `still`이 필요하다(그 뒤 인물을 바꿀 때 그대로 두려고 MiniMax에 함께 넣는다). 인물이 둘 이상이면 인물 사진 타일로 고르게 된다. 영상은 휴대폰에서 바로 재생되도록 H.264, faststart로 넣는다. 지금 들어 있는 10개(`simni-1~2`, `market-1~3`, `tea-1~2`, `river-1~3`)는 하동 트레일러 1차본 4편(각 30초, 1344x768, 같은 남녀 배우)에서 "얼굴이 잘 보이는 컷 둘 + 얼굴 없는 컷(풍경·손) 하나"를 묶어 만든 클립이다(소리는 첫 컷부터 이어지는 원본 소리). 끝에는 마지막 컷이 검정으로 디졸브되고 검정 바탕에 트레일러 끝 타이틀(장소 이름 + "화개(花開), 장날에 만나요", `scripts/titles/<장소>.png`)이 2초 떠서 전체 9.4~11.8초다. 타이틀은 원본 쪽 구간이라 엔진에 보내는 길이(요금)는 그대로이고, 완성 영상에도 같은 끝맺음이 붙는다(`parts`의 세 번째 값이 디졸브 프레임 수). `python3 scripts/make-clips.py <트레일러 폴더>`가 영상·목록 그림·`videos.json`의 `seconds`·`gen`·`parts`를 한 번에 만든다.

**얼굴 구간만 생성**: 요금이 영상 길이에 비례하므로 엔진에는 얼굴이 나오는 컷만 이어 붙인 생성용 영상(`gen.src`, `<id>-gen.mp4`)만 보낸다. 결과가 오면 서버(`/api/result`, `lib/stitch.ts`)가 `parts`(재생 순서대로 `["gen"|"orig", 프레임 수]`, 24fps) 순서로 "생성 결과의 얼굴 구간 + 원본의 얼굴 없는 구간"을 ffmpeg으로 이어 붙여 한 파일로 내준다(10초 안쪽, 소리는 원본). 화면·저장·이어 보기는 모두 이 주소를 쓰고, 다시 만들 때도 얼굴 구간만 다시 만든다. 이어 붙인 영상은 서버에 남기지 않는다(요청 때마다 만들고 브라우저가 하루 기억). 이어 붙이기에 실패하면 얼굴 구간만이라도 보여 준다. job id 끝에 영상 id를 붙여(`엔진.요청id.영상id`) 어느 영상과 붙일지 안다. H3 Max는 5초 미만을 받지 않아 얼굴 구간 합계는 5.4초 이상으로 둔다. 10편 예상 요금은 합계 약 $14.9, 편당 $1.26~1.75(평균 $1.49). Vercel에는 ffmpeg이 없어 `ffmpeg-static` 바이너리를 `/api/result` 함수에 함께 올린다(`next.config.ts`). 장면 전환이 있어도 H3 Max가 컷마다 인물을 바꾼다(2026-11-19 시험, 8초 115초). 컷마다 인물 위치가 바뀌어서 `target`은 왼쪽/오른쪽 대신 머리·옷차림으로 특정하고, 인물 사진(`{장소}-man.jpg`, `{장소}-woman.jpg`)은 장소별로 같이 쓴다. `outfit`은 영상 속 그 인물의 옷차림(영어)이다. 있으면 서버가 셀카 인물에게 그 옷을 입힌 캐릭터시트(정면·반측면·측면 한 장, `fal-ai/nano-banana-pro/edit`, 약 20초)를 먼저 만들어 H3 Max의 참고 사진으로 쓴다. 그러면 바뀐 뒤에도 옷이 원본과 같다(셀카만 넣으면 셀카 옷으로 바뀐다). 시트는 data URI로만 오가서 fal 저장소에 파일로 남지 않고, 40초 안에 못 만들면 셀카를 그대로 쓴다. `VTON_SHEET=0`이면 끈다. H3 Max 요금(2026-11-19 fal 페이지): 출력 초당 $0.085(768P)/$0.17(1080P, 최소 5초) + 입력 영상 토큰 1,000개당 $0.022(초당 약 6,750토큰, 컷 하나는 최소 2.5초로 계산, 처음 4,096개 무료). 768P 한 컷 기준 5초 약 $1.08, 8초 약 $1.78. 영상은 가로든 세로든 자르지 않고 원래 비율로 보여 준다. 실제 촬영 영상이 생기면 교체한다.

## 엔진

2026-10-21 2차 비교 기준 MiniMax H3 Max Recast가 기본이다 (실험은 1080P, 앱은 768P로 만든다). 닮음 점수가 가장 높고 2~3분 걸린다. 요금은 위 '영상 넣기'의 공식대로 8초 768P 약 $1.8이고 Kling O3(초당 약 $0.168, 8초 약 $1.3)보다 조금 비싸다. 비용을 줄일 땐 `VTON_ENGINE=kling-o3`로 바꾼다. 처음엔 셀카 1장만 넣었지만, 2026-11-19부터 장면 의상을 입힌 캐릭터시트를 만들어 넣는다(옷이 원본대로 유지됨). Kling O3가 가끔 원본과 거의 같은 영상을 돌려주므로, 브라우저에서 원본 대비 PSNR이 35dB를 넘으면 같은 셀카로 한 번 자동 재시도한다 (`lib/frameCheck.ts`). 실험 보고서는 프로젝트 파일 `vton/experiment/out/2026-10-21-jdrama/REPORT.md`.

## 생성 잠금 (정식 오픈 전)

기본값은 **잠금**이다. 목록과 장면 미리보기는 보이지만 「주인공 되기」를 누르면 "정식 오픈 때 열려요" 안내만 뜨고, 서버 `/api/jobs`도 503으로 막혀 fal 요금이 나가지 않는다. 열려면 Vercel 환경변수 `NEXT_PUBLIC_GENERATION_OPEN=1`을 넣고 Redeploy(빌드 때 들어가는 값이라 Redeploy 필요). 다시 잠그려면 지우고 Redeploy.

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
- 단계별 결과는 Vercel → Project → Logs에서 `vton event`로 검색한다. 한 줄에 하나씩 `{"e":"submitted|fitted|fit_skipped|started|generated|downloaded|download_failed|noop_retry|failed|submit_failed|net_weak|photo_check", ...}`이 남는다. `s`는 그 단계에 걸린 초, `env`는 기기(ios/android)와 앱 안 브라우저(kakao·naver 등). fal 쪽 실패 원문은 `job failed`로 검색한다. 서버 쪽은 `{"ev":"sheet_made"}`(캐릭터시트 완성), `{"ev":"stitched"}`(이어 붙이기 완료, 걸린 초·크기)가 남고, 이어 붙이기 실패는 `stitch failed`로 검색한다.
- 셀카 점검(얼굴·여러 명·크기·옆모습·밝기·흐림)은 휴대폰 안에서 MediaPipe로 한다. wasm은 설치 때 `scripts/copy-mediapipe.mjs`가 `public/mediapipe/`로 복사한다(저장소엔 없음).
- Vercel Hobby(무료) 요금제는 비상업 개인 용도 조건이 있어, 회사 실증이면 Pro를 검토한다.

## 남은 일

- 동의 기록을 DB(Supabase)에 남기기 (지금은 서버 로그에만 남김)
- 정식 서비스로 넘어갈 때 동의 문구 법무 검토
- 목소리 교체
