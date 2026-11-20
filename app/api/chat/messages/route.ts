import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/session";
import { getMessages, isTyping } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const cursor = Number(new URL(req.url).searchParams.get("cursor") ?? 0) || 0;
  const [result, peerTyping] = await Promise.all([
    getMessages(session.userId, cursor),
    isTyping(session.userId, "admin"),
  ]);

  return NextResponse.json({ ...result, peerTyping });
}
