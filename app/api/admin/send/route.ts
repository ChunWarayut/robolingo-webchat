import { NextResponse } from "next/server";
import { pushMessage } from "@/lib/line";
import { isAdmin } from "@/lib/session";
import { appendMessage, getConversation } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });

  const body = (await req.json().catch(() => null)) as { id?: string; text?: string } | null;
  const id = body?.id;
  const text = body?.text?.trim();

  if (!id) return NextResponse.json({ error: "ต้องเลือก User ที่จะตอบ" }, { status: 400 });
  if (!text) return NextResponse.json({ error: "ข้อความว่าง" }, { status: 400 });
  if (text.length > 2000) return NextResponse.json({ error: "ข้อความยาวเกิน 2000 ตัวอักษร" }, { status: 400 });

  const conversation = await getConversation(id);
  if (!conversation) return NextResponse.json({ error: "ไม่พบบทสนทนานี้" }, { status: 404 });

  try {
    await pushMessage(id, text);
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    console.error("[admin/send] push ล้มเหลว:", detail);
    return NextResponse.json(
      { error: "ส่งเข้า LINE ไม่สำเร็จ — ผู้ใช้อาจบล็อก/ลบเพื่อน หรือโควตาข้อความหมด", detail },
      { status: 502 },
    );
  }

  const message = await appendMessage(id, { from: "admin", via: "line", text });
  return NextResponse.json({ message });
}
