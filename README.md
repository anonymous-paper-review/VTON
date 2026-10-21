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

## 설정

| 변수 | 설명 |
| --- | --- |
| `FAL_KEY` | fal API 키. 서버에서만 쓴다. |
| `VTON_ENGINE` | `kling-o3`(기본) · `kling-o1` · `wan` · `seedance` |
| `VTON_MOCK` | `1`이면 모의 모드 |
| `NEXT_PUBLIC_SITE_URL` | QR에 넣을 배포 주소 |

## 영상 추가

`data/videos.json`에 항목을 넣는다. `src`는 fal이 받아갈 수 있는 공개 URL이어야 한다 (`/public` 경로는 배포 주소 기준으로 바뀐다). `target`은 프롬프트에서 교체할 인물을 특정하는 말이다 (예: `"the woman in the red coat"`). `public/videos/`의 mp4·jpg는 로컬 테스트용이라 커밋하지 않는다.

## 남은 일

- 엔진 비교 실험 결과에 맞춰 기본 엔진 정하기
- 셀카 → 캐릭터시트(정면·측면·뒷모습) 생성 단계 추가
- 동의 기록·24시간 삭제를 DB(Supabase)와 예약 작업으로 옮기기 (지금은 서버 로그에만 남김)
- 동의 문구 법무 검토
- 목소리 교체
