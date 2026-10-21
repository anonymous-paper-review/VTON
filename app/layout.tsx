import type { Metadata, Viewport } from "next";
import { LangProvider } from "./LangProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "화개장터 주인공 되기",
  description: "셀카 한 장으로 화개장터 영상 속 주인공이 되어 보세요.",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#14120f",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Noto+Sans+JP:wght@500;900&family=Noto+Sans+KR:wght@500;900&family=Noto+Sans+SC:wght@500;900&family=Noto+Serif+JP:wght@700;900&family=Noto+Serif+KR:wght@700;900&family=Noto+Serif+SC:wght@700;900&display=swap"
        />
      </head>
      <body>
        <LangProvider>{children}</LangProvider>
      </body>
    </html>
  );
}
