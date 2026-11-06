// 화면 문구 4개 국어. 키를 더하면 네 언어 모두 채운다.

export const LANGS = [
  { id: "ko", label: "한", code: "KO", name: "한국어" },
  { id: "zh", label: "中", code: "ZH", name: "中文" },
  { id: "en", label: "EN", code: "EN", name: "English" },
  { id: "ja", label: "日", code: "JA", name: "日本語" },
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
  "map.short": { ko: "지도", zh: "地图", en: "Map", ja: "地図" },
  "map.back": { ko: "지도 보기", zh: "查看地图", en: "View Map", ja: "地図を見る" },
  "app.name": { ko: "화개장터 주인공", zh: "花开市场主角", en: "Star in Hwagae", ja: "花開市場の主人公" },
  "home.place": { ko: "화개장터 · 십리벚꽃길", zh: "花开市场 · 十里樱花路", en: "Hwagae Market · Blossom Road", ja: "花開市場 · 十里桜並木" },
  "home.resume": { ko: "이어보기", zh: "继续查看", en: "Resume", ja: "続きを見る" },
  "lang.title": { ko: "언어", zh: "语言", en: "Language", ja: "言語" },
  "consent.head": { ko: "개인정보 동의", zh: "个人信息同意", en: "Consent", ja: "個人情報への同意" },
  "consent.need": { ko: "필수 항목에 모두 동의해 주세요", zh: "请同意所有必填项", en: "Please agree to all required items", ja: "必須項目すべてに同意してください" },
  "selfie.head": { ko: "셀카 찍기", zh: "拍自拍", en: "Take a selfie", ja: "自撮り" },
  "work.head": { ko: "영상 만드는 중", zh: "正在生成视频", en: "Making your video", ja: "映像を制作中" },
  "done.head": { ko: "완성", zh: "已完成", en: "Done", ja: "完成" },
  "home.kicker": { ko: "화개장터에서, 셀카 한 장으로", zh: "在花开市场，只需一张自拍", en: "At Hwagae Market, with one selfie", ja: "花開（ファゲ）市場で、自撮り1枚で" },
  "home.mega1": { ko: "화개장터", zh: "花开市场", en: "Star in", ja: "花開市場の" },
  "home.mega2": { ko: "주인공은", zh: "的主角", en: "Hwagae", ja: "主人公は" },
  "home.mega3": { ko: "당신.", zh: "就是你。", en: "Market.", ja: "あなた。" },
  "home.sub": { ko: "장면을 고르고 셀카를 찍으면, 화개장터 영상 속 주인공이 당신으로 바뀌어요.", zh: "选一个场景，拍一张自拍，花开市场视频里的主角就会变成你。", en: "Pick a scene, take a selfie, and the lead of the Hwagae Market film becomes you.", ja: "シーンを選んで自撮りすると、花開市場の映像の主人公があなたに変わります。" },
  "tab.simni": { ko: "십리벚꽃길", zh: "十里樱花路", en: "Blossom Road", ja: "十里桜並木" },
  "tab.market": { ko: "화개장터", zh: "花开市场", en: "Hwagae Market", ja: "花開市場" },
  "home.scenes": { ko: "장면 고르기", zh: "选择场景", en: "Choose a scene", ja: "シーンを選ぶ" },
  "home.free": { ko: "무료 시범 서비스", zh: "免费试用服务", en: "Free pilot service", ja: "無料パイロットサービス" },
  "common.sec": { ko: "초", zh: "秒", en: "s", ja: "秒" },
  "common.back": { ko: "뒤로", zh: "返回", en: "Back", ja: "戻る" },
  "common.list": { ko: "장면 목록", zh: "场景列表", en: "All scenes", ja: "シーン一覧" },

  "intro.who": { ko: "누가 되어 볼까요?", zh: "你想成为谁？", en: "Who will you be?", ja: "誰になってみる？" },
  "intro.whoSingle": { ko: "화개장터의 주인공이 되어 볼까요?", zh: "要成为花开市场的主角吗？", en: "Ready to star in Hwagae Market?", ja: "花開市場の主人公になってみる？" },
  "intro.note": {
    ko: "셀카 한 장으로 고른 인물이 당신으로 바뀌어요. 3~4분 정도 걸리고, 옷차림도 셀카를 따라 바뀔 수 있어요.",
    zh: "只需一张自拍，所选人物就会变成你。大约需要3~4分钟，服装也可能随自拍改变。",
    en: "One selfie turns the chosen character into you. It takes about 3–4 minutes, and the outfit may follow your selfie too.",
    ja: "自撮り1枚で選んだ人物があなたに変わります。3〜4分ほどかかり、服装も自撮りに合わせて変わることがあります。",
  },
  "intro.start": { ko: "화개장터 주인공 되기", zh: "成为花开市场的主角", en: "Star in Hwagae Market", ja: "花開市場の主人公になる" },
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
  "work.line1": { ko: "화개장터에 조명을 맞추는 중", zh: "正在为花开市场布光", en: "Lighting up Hwagae Market", ja: "花開市場に照明をセット中" },
  "work.line2": { ko: "당신을 주인공으로 캐스팅하는 중", zh: "正在选你当主角", en: "Casting you as the lead", ja: "あなたを主人公にキャスティング中" },
  "work.line3": { ko: "장터에서 카메라가 도는 중", zh: "摄影机正在市场里开拍", en: "Cameras rolling in the market", ja: "市場でカメラが回っています" },
  "work.line4": { ko: "마지막 컷을 편집하는 중", zh: "正在剪辑最后一幕", en: "Cutting the final take", ja: "最後のカットを編集中" },
  "work.slow": {
    ko: "사람이 몰려 평소보다 오래 걸리고 있어요. 앱을 닫아도 계속 만들어져요.",
    zh: "目前排队人数较多，比平时慢一些。关闭页面也会继续生成。",
    en: "It's busier than usual, so this is taking longer. It keeps going even if you close this page.",
    ja: "混み合っていて、いつもより時間がかかっています。ページを閉じても制作は続きます。",
  },
  "work.ahead": { ko: "앞에 {n}개가 기다리고 있어요.", zh: "前面还有{n}个。", en: "{n} ahead of you.", ja: "前に{n}件待っています。" },
  "work.again.btn": { ko: "같은 사진으로 다시 만들기", zh: "用同一张照片重新生成", en: "Try again with the same photo", ja: "同じ写真でもう一度作る" },
  "work.wait": { ko: "보통 3~6분 걸려요.", zh: "通常需要3~6分钟。", en: "Usually takes 3–6 minutes.", ja: "通常3〜6分かかります。" },
  "work.bg": {
    ko: "앱을 닫아도 영상은 계속 만들어져요. 이 페이지를 다시 열면 이어서 볼 수 있어요.",
    zh: "关闭页面后视频也会继续生成。重新打开此页面即可继续查看。",
    en: "Your video keeps rendering even if you close this page. Open it again to pick up where you left off.",
    ja: "ページを閉じても映像の制作は続きます。もう一度開けば続きから見られます。",
  },
  "work.link": { ko: "나중에 볼 링크 저장", zh: "保存稍后查看的链接", en: "Save a link for later", ja: "あとで見るリンクを保存" },
  "work.copied": { ko: "링크를 복사했어요", zh: "链接已复制", en: "Link copied", ja: "リンクをコピーしました" },
  "home.mine": { ko: "내 영상", zh: "我的视频", en: "My videos", ja: "わたしの映像" },
  "home.ready": { ko: "완성", zh: "已完成", en: "Ready", ja: "完成" },
  "home.making": { ko: "만드는 중", zh: "生成中", en: "Rendering", ja: "制作中" },
  "done.preparing": { ko: "저장할 영상을 준비하는 중", zh: "正在准备视频", en: "Preparing the video", ja: "保存する映像を準備中" },
  "done.saveHint": {
    ko: "공유 창이 뜨면 '동영상 저장'을 눌러 주세요.",
    zh: "弹出分享窗口后，请点击“保存视频”。",
    en: "When the share sheet opens, tap “Save Video”.",
    ja: "共有画面が出たら「ビデオを保存」を押してください。",
  },
  "work.failTitle": { ko: "이번 컷은 실패했어요", zh: "这一幕没有成功", en: "That take didn't work", ja: "今回のテイクは失敗しました" },
  "work.retry": { ko: "다시 찍어서 해보기", zh: "重新拍摄再试", en: "Retake and try again", ja: "撮り直して再挑戦" },
  "work.fetching": { ko: "완성된 영상을 받는 중", zh: "正在下载完成的视频", en: "Downloading your video", ja: "完成した映像を受信中" },
  "work.retrying": {
    ko: "더 잘 나오도록 한 번 더 만들고 있어요.",
    zh: "为了效果更好，正在再生成一次。",
    en: "Making it once more so it comes out right.",
    ja: "よりよい仕上がりのため、もう一度作っています。",
  },
  "stage.receive": { ko: "사진 접수", zh: "照片已接收", en: "Photo received", ja: "写真の受付" },
  "stage.make": { ko: "AI 영상 만들기", zh: "AI生成视频", en: "AI makes the video", ja: "AIが映像を制作" },
  "stage.fetch": { ko: "내 휴대폰으로 받기", zh: "下载到手机", en: "Download to your phone", ja: "スマホに受信" },
  "stage.sending": { ko: "사진 보내는 중 {pct}%", zh: "正在上传照片 {pct}%", en: "Sending photo {pct}%", ja: "写真を送信中 {pct}%" },
  "stage.queued": { ko: "접수 완료 · 앞에 {n}명이 기다리고 있어요", zh: "已接收 · 前面还有{n}人", en: "Received · {n} ahead of you", ja: "受付完了 · 前に{n}人待っています" },
  "stage.next": { ko: "접수 완료 · 곧 시작해요", zh: "已接收 · 马上开始", en: "Received · starting soon", ja: "受付完了 · まもなく開始" },
  "stage.received": { ko: "접수 완료", zh: "已接收", en: "Received", ja: "受付完了" },
  "stage.making": { ko: "{t} 지남 · 보통 4~5분 걸려요", zh: "已过 {t} · 通常需要4~5分钟", en: "{t} so far · usually 4–5 min", ja: "{t} 経過 · 通常4〜5分" },
  "stage.made": { ko: "완성", zh: "已完成", en: "Done", ja: "完成" },
  "stage.fetching": { ko: "{pct}% · {a} / {b}MB", zh: "{pct}% · {a} / {b}MB", en: "{pct}% · {a} / {b}MB", ja: "{pct}% · {a} / {b}MB" },
  "stage.fetchingMb": { ko: "{a}MB 받는 중", zh: "已下载 {a}MB", en: "{a}MB so far", ja: "{a}MB 受信中" },
  "stage.checking": { ko: "결과 확인 중", zh: "正在检查结果", en: "Checking the result", ja: "結果を確認中" },
  "net.weak": {
    ko: "인터넷 연결이 불안정해요. 영상은 서버에서 계속 만들어지고 있고, 연결되면 자동으로 이어져요.",
    zh: "网络连接不稳定。视频仍在服务器上继续生成，连接恢复后会自动继续。",
    en: "Your connection is unstable. The video is still being made on our server and this page will catch up once you're back online.",
    ja: "インターネット接続が不安定です。映像はサーバーで作り続けていて、つながると自動で続きます。",
  },
  "photo.checking": { ko: "사진 확인 중", zh: "正在检查照片", en: "Checking photo", ja: "写真を確認中" },
  "photo.noFace": { ko: "얼굴이 보이지 않아요. 얼굴이 원 안에 오도록 다시 찍어 주세요.", zh: "没有看到脸。请让脸位于圆圈内重新拍摄。", en: "We can't see a face. Please retake with your face in the circle.", ja: "顔が見えません。顔が円の中に入るように撮り直してください。" },
  "photo.many": { ko: "여러 사람이 보여요. 혼자 나오게 다시 찍어 주세요.", zh: "照片里有多个人。请只拍自己。", en: "There's more than one person. Please retake with just you.", ja: "複数の人が写っています。一人で撮り直してください。" },
  "photo.small": { ko: "얼굴이 너무 작아요. 조금 더 가까이에서 찍어 주세요.", zh: "脸太小了。请靠近一点再拍。", en: "Your face is too small. Please come a little closer.", ja: "顔が小さすぎます。もう少し近づいて撮ってください。" },
  "photo.side": { ko: "정면을 봐 주세요. 옆모습은 잘 바뀌지 않아요.", zh: "请正对镜头。侧脸效果不好。", en: "Please face the camera. Side views don't work well.", ja: "正面を向いてください。横顔はうまく変わりません。" },
  "photo.dark": { ko: "너무 어두워요. 밝은 곳에서 다시 찍어 주세요.", zh: "太暗了。请到明亮处重拍。", en: "It's too dark. Please retake somewhere brighter.", ja: "暗すぎます。明るい場所で撮り直してください。" },
  "photo.blur": { ko: "사진이 흔들렸어요. 휴대폰을 멈추고 다시 찍어 주세요.", zh: "照片模糊了。请拿稳手机重拍。", en: "The photo is blurry. Hold still and retake.", ja: "写真がぶれています。スマホを止めて撮り直してください。" },
  "photo.anyway": { ko: "그래도 이 사진으로", zh: "仍然使用这张照片", en: "Use it anyway", ja: "この写真で続ける" },

  "done.kicker": { ko: "나의 화개장터", zh: "我的花开市场", en: "My Hwagae Market", ja: "わたしの花開市場" },
  "done.title": { ko: "화개장터의 주인공이 되었어요", zh: "你成为了花开市场的主角", en: "You're the star of Hwagae Market", ja: "花開市場の主人公になりました" },
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

  "qr.title": { ko: "스캔하고 화개장터 주인공 되기", zh: "扫码成为花开市场的主角", en: "Scan to star in Hwagae Market", ja: "スキャンして花開市場の主人公に" },

  "err.video": { ko: "장면을 찾을 수 없어요.", zh: "找不到该场景。", en: "Scene not found.", ja: "シーンが見つかりません。" },
  "err.role": { ko: "바꿀 인물을 골라 주세요.", zh: "请选择要替换的人物。", en: "Please choose a character.", ja: "人物を選んでください。" },
  "err.consent": { ko: "개인정보 동의가 필요해요.", zh: "需要同意个人信息条款。", en: "Consent is required.", ja: "個人情報への同意が必要です。" },
  "err.selfie": { ko: "셀카 사진이 필요해요.", zh: "需要自拍照片。", en: "A selfie is required.", ja: "自撮り写真が必要です。" },
  "err.tooBig": { ko: "사진이 너무 커요.", zh: "照片太大。", en: "The photo is too large.", ja: "写真が大きすぎます。" },
  "err.length": { ko: "이 장면은 지금 처리할 수 없어요.", zh: "目前无法处理该场景。", en: "This scene can't be processed right now.", ja: "このシーンは現在処理できません。" },
  "err.safety": { ko: "안전 필터에 걸렸어요. 얼굴이 잘 보이는 사진으로 다시 찍어 주세요.", zh: "触发了安全过滤，请重新拍一张脸部清晰的照片。", en: "The safety filter blocked it. Please retake with your face clearly visible.", ja: "安全フィルターにかかりました。顔がはっきり写る写真で撮り直してください。" },
  "err.config": { ko: "서버 설정 문제로 지금은 만들 수 없어요.", zh: "由于服务器设置问题，暂时无法生成。", en: "Unavailable right now due to a server setting.", ja: "サーバー設定の問題で、現在は作成できません。" },
  "err.face": { ko: "사진에서 얼굴을 찾지 못했어요. 정면으로, 밝은 곳에서 다시 찍어 주세요.", zh: "照片中未识别到人脸，请在明亮处正面重拍。", en: "We couldn't find a face in the photo. Please retake facing the camera in good light.", ja: "写真から顔を見つけられませんでした。明るい場所で正面から撮り直してください。" },
  "err.busy": { ko: "지금 요청이 몰려 있어요. 잠시 뒤 다시 시도해 주세요.", zh: "目前请求较多，请稍后再试。", en: "We're very busy right now. Please try again shortly.", ja: "ただいま混み合っています。しばらくしてから再度お試しください。" },
  "err.timeout": { ko: "너무 오래 걸려서 멈췄어요. 다시 시도해 주세요.", zh: "等待时间过长，已停止。请重试。", en: "It took too long, so we stopped. Please try again.", ja: "時間がかかりすぎたため停止しました。もう一度お試しください。" },
  "err.network": { ko: "인터넷 연결이 끊겨 사진을 보내지 못했어요. 연결을 확인하고 다시 시도해 주세요.", zh: "网络中断，照片未能发送。请检查网络后重试。", en: "Your connection dropped and the photo wasn't sent. Check your connection and try again.", ja: "接続が切れて写真を送れませんでした。接続を確認してもう一度お試しください。" },
  "err.generic": { ko: "영상을 만들지 못했어요. 잠시 뒤 다시 시도해 주세요.", zh: "视频生成失败，请稍后再试。", en: "Couldn't make the video. Please try again shortly.", ja: "映像を作成できませんでした。しばらくしてから再度お試しください。" },
} satisfies Record<string, Localized>;

export type MsgKey = keyof typeof dict;

export const translate = (lang: Lang, key: MsgKey) => dict[key][lang];

/** API가 돌려주는 오류 코드 → 문구 키 */
export const errKey = (code: string | undefined): MsgKey =>
  code && `err.${code}` in dict ? (`err.${code}` as MsgKey) : "err.generic";
