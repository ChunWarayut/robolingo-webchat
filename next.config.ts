import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // ปิด cacheComponents ที่ create-next-app เปิดมาให้: แอปนี้เป็นแชทที่ทุกหน้าต้อง dynamic
  // อยู่แล้ว (อ่าน cookie + polling) การเปิดไว้มีแต่ทำให้ต้องใส่ Suspense/'use cache' เพิ่มโดยไม่ได้ประโยชน์
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
