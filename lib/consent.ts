// 개인정보 수집·이용 및 국외 이전 동의 문구.
// 초안이다: 현장 운영 전 법무 검토를 받고, 문구를 바꾸면 CONSENT_VERSION을 올린다.

export const CONSENT_VERSION = "2026-10-21-draft";

export const RETENTION_HOURS = 24;

export const consentItems = [
  {
    id: "collect",
    title: "[필수] 개인정보 수집·이용 동의",
    body: [
      "수집 항목: 얼굴이 포함된 셀카 사진 1장, 이를 이용해 만든 영상",
      "이용 목적: 선택한 영상의 주인공 얼굴을 내 얼굴로 바꾼 영상 생성 및 제공",
      `보유 기간: 생성 후 ${RETENTION_HOURS}시간이 지나면 서비스에서 삭제합니다.`,
      "동의를 거부할 수 있으며, 거부하면 얼굴 바꾸기를 이용할 수 없습니다.",
    ],
  },
  {
    id: "transfer",
    title: "[필수] 개인정보 국외 이전 동의",
    body: [
      "이전받는 자: Features & Labels, Inc. (fal.ai), 미국",
      "이전 항목: 셀카 사진, 선택한 영상",
      "이전 목적: AI 영상 생성 처리",
      "이전 방법: 촬영 직후 암호화된 통신(HTTPS)으로 전송",
      `보유 기간: 처리 완료 후 ${RETENTION_HOURS}시간 이내 삭제 요청`,
      "동의를 거부할 수 있으며, 거부하면 얼굴 바꾸기를 이용할 수 없습니다.",
    ],
  },
] as const;

export type ConsentRecord = { version: string; agreedAt: string; items: string[] };
