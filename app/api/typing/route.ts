import { NextResponse } from "next/server";
import { getUserSession, isAdmin } from "@/lib/session";
import { setTyping } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * ปักหมุดว่า "กำลังพิมพ์อยู่" — ฝั่งตรงข้ามจะเห็นผ่าน polling รอบถัดไป
 * แอดมินต้องบอกด้วยว่ากำลังพิมพ์ถึงใคร ส่วนผู้ใช้ปักที่ห้องของตัวเองเสมอ
 */
export async function POST(req: Request) {
  if (await isAdmin()) {
    const body = (await req.json().catch(() => null)) as { id?: string } | null;
    if (!body?.id) return NextResponse.json({ error: "ต้องระบุ id" }, { status: 400 });
    await setTyping(body.id, "admin");
    return NextResponse.json({ ok: true });
  }

  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  await setTyping(session.userId, "user");
  return NextResponse.json({ ok: true });
}
