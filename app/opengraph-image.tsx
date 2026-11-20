import { ImageResponse } from "next/og";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";
export const alt = "Robolingo Webchat × LINE Official Account";

/** ภาพพรีวิวตอนแปะลิงก์ — ข้อความเป็นละตินล้วนด้วยเหตุผลเดียวกับไอคอน */
export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "center",
          background: "#09090B",
          color: "#FAFAFA",
          padding: 88,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            width: 96,
            height: 96,
            borderRadius: 24,
            background: "#4F46E5",
            fontSize: 56,
            fontWeight: 700,
          }}
        >
          R
        </div>

        <div style={{ display: "flex", fontSize: 68, fontWeight: 700, marginTop: 44, letterSpacing: -1.5 }}>
          Robolingo Webchat
        </div>

        <div style={{ display: "flex", fontSize: 34, color: "#A1A1AA", marginTop: 18 }}>
          Two-way chat with a LINE Official Account
        </div>

        <div style={{ display: "flex", fontSize: 26, color: "#52525B", marginTop: 44 }}>
          Next.js · TypeScript · Upstash Redis · Vercel
        </div>
      </div>
    ),
    size,
  );
}
