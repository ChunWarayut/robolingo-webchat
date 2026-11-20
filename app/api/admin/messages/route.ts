import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { getConversation, getMessages, isTyping, markRead } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });

  const params = new URL(req.url).searchParams;
  const id = params.get("id");
  if (!id) return NextResponse.json({ error: "ต้องระบุ id ของบทสนทนา" }, { status: 400 });

  const cursor = Number(params.get("cursor") ?? 0) || 0;
  const [conversation, result, peerTyping] = await Promise.all([
    getConversation(id),
    getMessages(id, cursor),
    isTyping(id, "user"),
  ]);

  // เปิดอ่านแล้วถือว่าเคลียร์ตัวนับ
  if (result.messages.length > 0) await markRead(id);

  return NextResponse.json({ conversation, ...result, peerTyping });
}
