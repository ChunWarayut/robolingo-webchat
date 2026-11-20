import { NextResponse } from "next/server";
import { getBaseUrl } from "@/lib/env";
import { clearAdminSession, clearUserSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ต้องเป็น 303 ไม่ใช่ค่าเริ่มต้น 307 ของ NextResponse.redirect
 *
 * 307 สั่งให้เบราว์เซอร์ทำซ้ำด้วย method เดิม ปลายทางจึงกลายเป็น POST ไปหน้าเว็บ
 * ซึ่งไม่ใช่สิ่งที่หน้านั้นมีไว้รับ ผลคือการนำทางไม่สำเร็จ เบราว์เซอร์ค้างอยู่หน้าเดิม
 * ทั้งที่ cookie ถูกลบไปแล้ว ผู้ใช้เลยเห็นหน้า inbox ที่ยิง API แล้ว 401 ทุกครั้ง
 *
 * 303 (See Other) คือสถานะที่มีไว้สำหรับ "POST สำเร็จแล้วไปดูที่หน้านี้ต่อ"
 * เบราว์เซอร์จะเปลี่ยนเป็น GET ให้เอง
 */
const SEE_OTHER = 303;

export async function POST(req: Request) {
  const scope = new URL(req.url).searchParams.get("scope");

  if (scope === "admin") {
    await clearAdminSession();
    return NextResponse.redirect(new URL("/admin/login", getBaseUrl(req)), SEE_OTHER);
  }

  await clearUserSession();
  return NextResponse.redirect(new URL("/", getBaseUrl(req)), SEE_OTHER);
}
