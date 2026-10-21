// 화면 문구 4개 국어. 키를 더하면 네 언어 모두 채운다.

export const LANGS = [
  { id: "ko", label: "한" },
  { id: "zh", label: "中" },
  { id: "en", label: "EN" },
  { id: "ja", label: "日" },
] as const;

export type Lang = (typeof LANGS)[number]["id"];
export type Localized = Record<Lang, string>;

export const DEFAULT_LANG: Lang = "ko";

export function detectLang(nav: string | undefined): Lang {
  const l = (nav ?? "").toLowerCase();
  if (l.startsWith("zh")) return "zh";
  if (l.startsWith("ja")) return "ja";
  if (l.startsWith("ko")) return "ko";
  return l ? "en" : DEFAULT_LANG;
}

const dict = {
  "home.kicker": { ko: "셀카 한 장이면 충분해요", zh: "一张自拍就够了", en: "One selfie is all it takes", ja: "自撮り1枚でOK" },
  "home.hero1": { ko: "YOU ARE", zh: "YOU ARE", en: "YOU ARE", ja: "YOU ARE" },
  "home.hero2": { ko: "THE LEAD", zh: "THE LEAD", en: "THE LEAD", ja: "THE LEAD" },
  "home.sub": {
    ko: "장면을 고르고 셀카를 찍으면, 영상 속 주인공이 당신으로 바뀌어요.",
    zh: "选择场景并拍一张自拍，视频里的主角就会变成你。",
    en: "Pick a scene, take a selfie, and the lead in the film becomes you.",
    ja: "シーンを選んで自撮りすると、映像の主人公があなたに変わります。",
  },
  "home.scenes": { ko: "장면 고르기", zh: "选择场景", en: "Choose a scene", ja: "シーンを選ぶ" },
  "home.free": { ko: "무료 시범 서비스", zh: "免费试用服务", en: "Free pilot service", ja: "無料パイロットサービス" },
  "common.sec": { ko: "초", zh: "秒", en: "s", ja: "秒" },
  "common.back": { ko: "뒤로", zh: "返回", en: "Back", ja: "戻る" },
  "common.list": { ko: "장면 목록", zh: "场景列表", en: "All scenes", ja: "シーン一覧" },

  "intro.who": { ko: "누가 되어 볼까요?", zh: "你想成为谁？", en: "Who will you be?", ja: "誰になってみる？" },
  "intro.whoSingle": { ko: "주인공이 되어 볼까요?", zh: "要成为主角吗？", en: "Ready to be the lead?", ja: "主人公になってみる？" },
  "intro.note": {
    ko: "셀카 한 장으로 고른 인물이 당신으로 바뀌어요. 3~4분 정도 걸리고, 옷차림도 셀카를 따라 바뀔 수 있어요.",
    zh: "只需一张自拍，所选人物就会变成你。大约需要3~4分钟，服装也可能随自拍改变。",
    en: "One selfie turns the chosen character into you. It takes about 3–4 minutes, and the outfit may follow your selfie too.",
    ja: "自撮り1枚で選んだ人物があなたに変わります。3〜4分ほどかかり、服装も自撮りに合わせて変わることがあります。",
  },
  "intro.start": { ko: "주인공 되기", zh: "成为主角", en: "Be the lead", ja: "主人公になる" },
  "intro.become": { ko: "이 사람 되기", zh: "成为TA", en: "Become", ja: "この人になる" },

  "step.consent": { ko: "동의", zh: "同意", en: "Consent", ja: "同意" },
  "step.selfie": { ko: "셀카", zh: "自拍", en: "Selfie", ja: "自撮り" },
  "step.make": { ko: "제작", zh: "生成", en: "Create", ja: "制作" },

  "consent.title": { ko: "시작하기 전에", zh: "开始之前", en: "Before we start", ja: "はじめる前に" },
  "consent.sub": {
    ko: "무료 시범 서비스예요. 얼굴 사진은 영상을 만드는 데에만 쓰고, 서비스 서버에는 저장하지 않아요.",
    zh: "这是免费试用服务。面部照片仅用于生成视频，不会保存在服务服务器上。",
    en: "This is a free pilot. Your photo is used only to make the video and is never stored on our servers.",
    ja: "無料のパイロットサービスです。顔写真は映像の制作にのみ使い、サービスのサーバーには保存しません。",
  },
  "consent.all": { ko: "모두 동의해요", zh: "全部同意", en: "I agree to all", ja: "すべて同意する" },
  "consent.view": { ko: "보기", zh: "查看", en: "View", ja: "表示" },
  "consent.next": { ko: "동의하고 셀카 찍기", zh: "同意并拍自拍", en: "Agree & take a selfie", ja: "同意して自撮りへ" },

  "selfie.title": { ko: "얼굴을 원 안에", zh: "把脸放进圆圈里", en: "Face in the circle", ja: "顔を円の中に" },
  "selfie.tip": {
    ko: "정면으로, 밝은 곳에서. 모자와 마스크는 벗어 주세요.",
    zh: "请正面、在明亮处拍摄，并摘下帽子和口罩。",
    en: "Look straight ahead in good light. Remove hats and masks.",
    ja: "正面から、明るい場所で。帽子とマスクは外してください。",
  },
  "selfie.shoot": { ko: "촬영", zh: "拍摄", en: "Shoot", ja: "撮影" },
  "selfie.album": { ko: "앨범", zh: "相册", en: "Album", ja: "アルバム" },
  "selfie.noCam": {
    ko: "카메라를 열 수 없어요. 앨범에서 사진을 골라 주세요.",
    zh: "无法打开相机，请从相册选择照片。",
    en: "Can't open the camera. Please pick a photo from your album.",
    ja: "カメラを起動できません。アルバムから写真を選んでください。",
  },
  "selfie.pickPhoto": { ko: "사진 고르기", zh: "选择照片", en: "Pick a photo", ja: "写真を選ぶ" },
  "selfie.use": { ko: "이 사진으로 만들기", zh: "用这张照片生成", en: "Use this photo", ja: "この写真で作る" },
  "selfie.retake": { ko: "다시 찍기", zh: "重拍", en: "Retake", ja: "撮り直す" },
  "selfie.badFile": { ko: "이 사진은 열 수 없어요. 다른 사진을 골라 주세요.", zh: "无法打开这张照片，请换一张。", en: "That photo can't be opened. Please choose another.", ja: "この写真は開けません。別の写真を選んでください。" },

  "work.sending": { ko: "사진을 보내는 중", zh: "正在上传照片", en: "Sending your photo", ja: "写真を送信中" },
  "work.again": { ko: "한 번 더 다듬는 중", zh: "正在再次优化", en: "Giving it another take", ja: "もう一度撮り直し中" },
  "work.queued": { ko: "촬영 순서를 기다리는 중", zh: "正在排队等待", en: "Waiting for your turn", ja: "順番待ち" },
  "work.checking": { ko: "결과를 확인하는 중", zh: "正在检查结果", en: "Checking the result", ja: "結果を確認中" },
  "work.line1": { ko: "조명을 맞추는 중", zh: "正在调整灯光", en: "Setting the lights", ja: "照明を調整中" },
  "work.line2": { ko: "당신을 캐스팅하는 중", zh: "正在为你选角", en: "Casting you", ja: "あなたをキャスティング中" },
  "work.line3": { ko: "카메라가 다시 도는 중", zh: "摄影机重新开拍", en: "Rolling the camera", ja: "カメラを回しています" },
  "work.line4": { ko: "마지막 컷을 편집하는 중", zh: "正在剪辑最后一幕", en: "Cutting the final take", ja: "最後のカットを編集中" },
  "work.wait": {
    ko: "보통 3~4분 걸려요. 화면을 닫지 말고 기다려 주세요.",
    zh: "通常需要3~4分钟，请不要关闭页面。",
    en: "Usually 3–4 minutes. Please keep this screen open.",
    ja: "通常3〜4分かかります。画面を閉じずにお待ちください。",
  },
  "work.failTitle": { ko: "이번 컷은 실패했어요", zh: "这一幕没有成功", en: "That take didn't work", ja: "今回のテイクは失敗しました" },
  "work.retry": { ko: "다시 찍어서 해보기", zh: "重新拍摄再试", en: "Retake and try again", ja: "撮り直して再挑戦" },

  "done.kicker": { ko: "YOUR SCENE", zh: "YOUR SCENE", en: "YOUR SCENE", ja: "YOUR SCENE" },
  "done.title": { ko: "주인공이 되었어요", zh: "你成为了主角", en: "You're the lead now", ja: "主人公になりました" },
  "done.after": { ko: "결과", zh: "结果", en: "After", ja: "結果" },
  "done.before": { ko: "원본", zh: "原片", en: "Before", ja: "元の映像" },
  "done.save": { ko: "영상 저장하기", zh: "保存视频", en: "Save video", ja: "動画を保存" },
  "done.retry": { ko: "다시 찍기", zh: "重拍", en: "Retake", ja: "撮り直す" },
  "done.other": { ko: "다른 장면", zh: "其他场景", en: "Other scenes", ja: "ほかのシーン" },
  "done.keep": {
    ko: "영상 링크는 시간이 지나면 열리지 않을 수 있어요. 마음에 들면 지금 저장해 주세요.",
    zh: "视频链接一段时间后可能失效，喜欢的话请现在保存。",
    en: "The video link may expire. Save it now if you like it.",
    ja: "動画のリンクは時間が経つと開けなくなることがあります。気に入ったら今すぐ保存してください。",
  },

  "qr.title": { ko: "스캔하고 주인공 되기", zh: "扫码成为主角", en: "Scan to be the lead", ja: "スキャンして主人公に" },

  "err.video": { ko: "장면을 찾을 수 없어요.", zh: "找不到该场景。", en: "Scene not found.", ja: "シーンが見つかりません。" },
  "err.role": { ko: "바꿀 인물을 골라 주세요.", zh: "请选择要替换的人物。", en: "Please choose a character.", ja: "人物を選んでください。" },
  "err.consent": { ko: "개인정보 동의가 필요해요.", zh: "需要同意个人信息条款。", en: "Consent is required.", ja: "個人情報への同意が必要です。" },
  "err.selfie": { ko: "셀카 사진이 필요해요.", zh: "需要自拍照片。", en: "A selfie is required.", ja: "自撮り写真が必要です。" },
  "err.tooBig": { ko: "사진이 너무 커요.", zh: "照片太大。", en: "The photo is too large.", ja: "写真が大きすぎます。" },
  "err.length": { ko: "이 장면은 지금 처리할 수 없어요.", zh: "目前无法处理该场景。", en: "This scene can't be processed right now.", ja: "このシーンは現在処理できません。" },
  "err.safety": { ko: "안전 필터에 걸렸어요. 얼굴이 잘 보이는 사진으로 다시 찍어 주세요.", zh: "触发了安全过滤，请重新拍一张脸部清晰的照片。", en: "The safety filter blocked it. Please retake with your face clearly visible.", ja: "安全フィルターにかかりました。顔がはっきり写る写真で撮り直してください。" },
  "err.config": { ko: "서버 설정 문제로 지금은 만들 수 없어요.", zh: "由于服务器设置问题，暂时无法生成。", en: "Unavailable right now due to a server setting.", ja: "サーバー設定の問題で、現在は作成できません。" },
  "err.generic": { ko: "영상을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.", zh: "视频生成失败，请稍后再试。", en: "Couldn't make the video. Please try again shortly.", ja: "映像を作成できませんでした。しばらくしてから再度お試しください。" },
} satisfies Record<string, Localized>;

export type MsgKey = keyof typeof dict;

export const translate = (lang: Lang, key: MsgKey) => dict[key][lang];

/** API가 돌려주는 오류 코드 → 문구 키 */
export const errKey = (code: string | undefined): MsgKey =>
  code && `err.${code}` in dict ? (`err.${code}` as MsgKey) : "err.generic";
