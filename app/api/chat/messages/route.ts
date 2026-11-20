import { NextResponse } from "next/server";
import { getUserSession } from "@/lib/session";
import { getMessages } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const session = await getUserSession();
  if (!session) return NextResponse.json({ error: "ยังไม่ได้เข้าสู่ระบบ" }, { status: 401 });

  const cursor = Number(new URL(req.url).searchParams.get("cursor") ?? 0) || 0;
  const result = await getMessages(session.userId, cursor);

  return NextResponse.json(result);
}
