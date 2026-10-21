import { headers } from "next/headers";
import QRCode from "qrcode";
import { LANGS, translate } from "@/lib/i18n";
import { Mega } from "../HomeView";

// 현장에 붙일 QR 포스터. 큰 제목은 한국어, 아래 안내는 4개 국어. 배포 주소가 정해지면 NEXT_PUBLIC_SITE_URL로 고정한다.
export default async function QrPage() {
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const svg = await QRCode.toString(origin, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return (
    <div className="poster" lang="ko">
      <Mega lines={[translate("ko", "home.mega1"), translate("ko", "home.mega2"), translate("ko", "home.mega3")]} />
      <div className="qr" dangerouslySetInnerHTML={{ __html: svg }} />
      <div className="langs">
        {LANGS.map((l) => <span key={l.id} lang={l.id}>{translate(l.id, "qr.title")}</span>)}
      </div>
      <code>{origin}</code>
    </div>
  );
}
