import type { Metadata, Viewport } from "next";
import { LangProvider } from "./LangProvider";
import "./tokens.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "화개장터 주인공 되기",
  description: "셀카 한 장으로 화개장터 영상 속 주인공이 되어 보세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#FFFFFF",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        {/* Pretendard(OFL)는 직접 싣는다. Pretendard에 없는 글자(한자·가나·태국·아랍)는 Noto, 베트남·스페인·인니어는 Inter로 받는다. 글자별 unicode-range라 쓰는 언어 글꼴만 내려받는다. */}
        <link rel="stylesheet" href="/fonts/pretendard/pretendardvariable-dynamic-subset.css" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;600;700&family=Noto+Sans+SC:wght@500;600;700&family=Noto+Sans+TC:wght@500;600;700&family=Noto+Sans+Thai:wght@500;600;700&family=Noto+Sans+Arabic:wght@500;600;700&family=Inter:wght@500;600;700&display=swap"
        />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
