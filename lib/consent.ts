// 개인정보 수집·이용, 국외 처리위탁(국외 이전), 나이 확인 동의 문구 (4개 국어).
// 무료 시범 실증(사용자 동의 기반) 기준으로 일반 앱 수준에 맞췄다. 문구를 바꾸면 CONSENT_VERSION을 올린다.

import type { Localized } from "@/lib/i18n";

export const CONSENT_VERSION = "2026-11-07";

type Item = { id: string; title: Localized; body: Localized[] };

const refuse: Localized = {
  ko: "동의하지 않을 수 있으며, 동의하지 않으면 얼굴 바꾸기를 이용할 수 없습니다.",
  zh: "您可以拒绝同意，但拒绝后将无法使用换脸功能。",
  en: "You may decline, but you won't be able to use the face swap.",
  ja: "同意しないこともできますが、その場合は顔の入れ替えを利用できません。",
};

export const consentItems: Item[] = [
  {
    id: "age",
    title: { ko: "[필수] 만 14세 이상입니다", zh: "[必选] 我已年满14周岁", en: "[Required] I am 14 or older", ja: "[必須] 14歳以上です" },
    body: [
      {
        ko: "만 14세 미만은 보호자 동의 없이 이용할 수 없습니다.",
        zh: "未满14周岁者须经监护人同意方可使用。",
        en: "Users under 14 may not use the service without a guardian's consent.",
        ja: "14歳未満の方は保護者の同意なしに利用できません。",
      },
    ],
  },
  {
    id: "collect",
    title: { ko: "[필수] 개인정보 수집·이용 동의", zh: "[必选] 同意收集和使用个人信息", en: "[Required] Collection and use of personal data", ja: "[必須] 個人情報の収集・利用への同意" },
    body: [
      { ko: "수집·이용하는 자: 테일스튜디오(Tale Studio)", zh: "收集和使用方：Tale Studio", en: "Controller: Tale Studio", ja: "収集・利用者：Tale Studio（テイルスタジオ）" },
      { ko: "수집 항목: 얼굴이 나온 셀카 사진 1장, 이를 이용해 만든 영상", zh: "收集项目：一张露脸的自拍照片，以及用其生成的视频", en: "Data: one selfie showing your face, and the video made from it", ja: "収集項目：顔が写った自撮り写真1枚、それを使って作成した映像" },
      { ko: "이용 목적: 선택한 영상 속 인물을 내 얼굴로 바꾼 영상을 만들어 보여 드리는 시범 서비스 제공", zh: "使用目的：提供将所选视频中的人物换成你的脸并展示给你的试用服务", en: "Purpose: providing a pilot service that makes and shows you a video with the chosen character replaced by you", ja: "利用目的：選んだ映像の人物をあなたの顔に入れ替えた映像を作成・提供する試験サービスのため" },
      { ko: "보유 기간: 셀카는 서비스 서버에 저장하지 않고 영상을 만드는 데에만 씁니다. 만든 영상은 24시간 뒤 자동으로 삭제됩니다.", zh: "保存期限：自拍照片不会保存在服务服务器上，仅用于生成视频。生成的视频将在24小时后自动删除。", en: "Retention: your selfie is not stored on our servers and is used only to make the video. The video is deleted automatically after 24 hours.", ja: "保存期間：自撮り写真はサービスのサーバーに保存せず、映像の作成にのみ使います。作成した映像は24時間後に自動で削除されます。" },
      { ko: "무료 시범 운영(실증)이며, 사진과 영상을 광고·학습 등 다른 목적으로 쓰지 않습니다.", zh: "本服务为免费试运营，不会将照片和视频用于广告、训练等其他目的。", en: "This is a free pilot; photos and videos are not used for advertising, training, or any other purpose.", ja: "無料の試験運用であり、写真と映像を広告や学習など他の目的に使用しません。" },
      refuse,
    ],
  },
  {
    id: "transfer",
    title: { ko: "[필수] 개인정보 국외 처리위탁(국외 이전) 동의", zh: "[必选] 同意委托境外处理（跨境传输）个人信息", en: "[Required] Processing by an overseas provider (transfer abroad)", ja: "[必須] 個人情報の国外への処理委託（国外移転）への同意" },
    body: [
      { ko: "영상은 테일스튜디오가 직접 만들지 않고 아래 업체에 맡겨 만듭니다. 이 업체는 셀카를 영상 생성에만 쓰며 다른 목적으로 쓰지 않습니다.", zh: "视频并非由Tale Studio直接生成，而是委托以下公司生成。该公司仅将自拍用于生成视频，不作他用。", en: "Tale Studio does not make the video itself; it is made by the provider below on our behalf. The provider uses your selfie only to make the video and for nothing else.", ja: "映像はTale Studioが直接作るのではなく、下記の事業者に委託して作成します。この事業者は自撮り写真を映像の作成にのみ使い、他の目的には使いません。" },
      { ko: "수탁자(이전받는 자): Features & Labels, Inc. (fal.ai), 미국", zh: "受托方（接收方）：Features & Labels, Inc.（fal.ai），美国", en: "Provider (recipient): Features & Labels, Inc. (fal.ai), USA", ja: "受託者（移転先）：Features & Labels, Inc.（fal.ai）、米国" },
      { ko: "위탁 업무: AI 영상 생성 (선택한 영상 속 인물을 내 얼굴로 바꾸기)", zh: "委托业务：AI视频生成（将所选视频中的人物换成你的脸）", en: "Task: AI video generation (replacing the chosen character with you)", ja: "委託業務：AI映像の生成（選んだ映像の人物をあなたの顔に入れ替える）" },
      { ko: "이전 항목: 셀카 사진 1장, 선택한 영상", zh: "传输项目：一张自拍照片、所选视频", en: "Data: one selfie and the chosen video", ja: "移転項目：自撮り写真1枚、選んだ映像" },
      { ko: "이전 국가·시기·방법: 미국, '이 사진으로 만들기'를 누를 때 암호화 통신(HTTPS)으로 전송", zh: "传输国家、时间及方式：美国，点击“用这张照片生成”时通过加密通信（HTTPS）传输", en: "Country, when and how: USA, sent over encrypted HTTPS when you tap “Use this photo”", ja: "移転先の国・時期・方法：米国、「この写真で作る」を押したときに暗号化通信（HTTPS）で送信" },
      { ko: "보유 기간: 셀카는 별도 파일로 보관하지 않으며, 만든 영상은 24시간 뒤 fal.ai 저장소에서 자동 삭제됩니다.", zh: "保存期限：自拍照片不会另存为文件，生成的视频将在24小时后从fal.ai存储中自动删除。", en: "Retention: your selfie is not kept as a separate file, and the video is deleted automatically from fal.ai storage after 24 hours.", ja: "保存期間：自撮り写真は別ファイルとして保管せず、作成した映像は24時間後にfal.aiのストレージから自動で削除されます。" },
      refuse,
    ],
  },
];
