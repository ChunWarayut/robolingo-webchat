import { ImageResponse } from "next/og";

export const size = { width: 64, height: 64 };
export const contentType = "image/png";

/**
 * ไอคอนประจำแอป สร้างตอน build ด้วย next/og จึงไม่ต้องมีไฟล์ไบนารีใน repo
 * ใช้ตัวอักษรละตินล้วนเพราะฟอนต์เริ่มต้นของ ImageResponse ไม่มี glyph ภาษาไทย
 */
export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#4F46E5",
          color: "#FAFAFA",
          fontSize: 40,
          fontWeight: 700,
          borderRadius: 16,
        }}
      >
        R
      </div>
    ),
    size,
  );
}
