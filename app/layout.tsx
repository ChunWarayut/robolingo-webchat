import type { Metadata } from "next";
import { Geist_Mono, Noto_Sans_Thai } from "next/font/google";
import "./globals.css";

const notoSansThai = Noto_Sans_Thai({
  variable: "--font-geist-sans",
  subsets: ["thai", "latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Robolingo Webchat × LINE OA",
  description: "เว็บแชทที่ส่งและรับข้อความกับ LINE Official Account",
};

/**
 * อ่านธีมที่เลือกไว้ก่อนเบราว์เซอร์วาดหน้าแรก ไม่งั้นจะเห็นพื้นขาวแวบหนึ่งก่อนสลับเป็นดาร์ก
 * ต้องเป็น inline script เพราะต้องรันแบบ blocking ก่อน paint
 */
const themeBootstrap = `(function(){try{var t=localStorage.getItem("rb-theme");if(t==="dark"||t==="light"){document.documentElement.setAttribute("data-theme",t)}}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="th"
      suppressHydrationWarning
      className={`${notoSansThai.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="h-full">
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
        {children}
      </body>
    </html>
  );
}
