import { headers } from "next/headers";
import QRCode from "qrcode";

// 현장에 붙일 QR. 배포 주소가 정해지면 NEXT_PUBLIC_SITE_URL로 고정한다.
export default async function QrPage() {
  const h = await headers();
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? `${h.get("x-forwarded-proto") ?? "https"}://${h.get("host")}`;
  const svg = await QRCode.toString(origin, { type: "svg", margin: 1, errorCorrectionLevel: "M" });
  return (
    <div className="qr">
      <h1>영상 속 주인공 되기</h1>
      <div dangerouslySetInnerHTML={{ __html: svg }} />
      <p className="muted">휴대폰 카메라로 스캔하세요</p>
      <code className="muted">{origin}</code>
    </div>
  );
}
