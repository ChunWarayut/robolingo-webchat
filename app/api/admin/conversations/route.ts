import { NextResponse } from "next/server";
import { isAdmin } from "@/lib/session";
import { listConversations } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: "ต้องเข้าสู่ระบบแอดมิน" }, { status: 401 });

  const conversations = await listConversations();
  return NextResponse.json({ conversations });
}
