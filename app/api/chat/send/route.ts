import { NextResponse } from "next/server";
import { optionalEnv } from "@/lib/env";
import { pushMessage } from "@/lib/line";
import { getUserSession } from "@/lib/session";
import { appendMessage, ensureConversation } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = body?.text?.trim();
  if (!text) return NextResponse.json({ error: "ข้อความว่าง" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "ข้อความยาวเกิน 2000 ตัวอักษร" }, { status: 400 });

  await ensureConversation(session.userId, {
    displayName: session.displayName,
    pictureUrl: session.pictureUrl,
  });
  const message = await appendMessage(session.userId, { from: "user", via: "web", text });

  // ส่งเข้าแชท LINE ของผู้ใช้เองด้วย เพื่อให้เห็นใน LINE OA ว่าข้อความจากเว็บเข้ามาจริง
  // (push หาผู้ใช้ไม่ทำให้เกิด webhook ย้อนกลับ จึงไม่มี loop)
  const warnings: string[] = [];
  try {
    await pushMessage(session.userId, `💬 (จากเว็บแชท) ${text}`);
  } catch (error) {
    // ยังไม่ได้เพิ่ม OA เป็นเพื่อน หรือโควตาหมด — ข้อความยังอยู่ในระบบและแอดมินเห็นปกติ
    warnings.push("ส่งเข้าแชท LINE ของคุณไม่ได้ (อาจยังไม่ได้เพิ่ม OA เป็นเพื่อน)");
    console.error("[chat/send] echo push ล้มเหลว:", error);
  }

  // แจ้งเตือนแอดมินใน LINE ถ้าตั้งค่าไว้
  const adminUserId = optionalEnv("ADMIN_LINE_USER_ID");
  if (adminUserId && adminUserId !== session.userId) {
    try {
      await pushMessage(adminUserId, `🌐 [เว็บแชท] ${session.displayName}: ${text}`);
    } catch (error) {
      console.error("[chat/send] แจ้งเตือนแอดมินล้มเหลว:", error);
    }
  }

  return NextResponse.json({ message, warnings });
}
