import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { setAdminSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const body = (await req.json().catch(() => null)) as { password?: string } | null;

  if (!body?.password || body.password !== requireEnv("ADMIN_PASSWORD")) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  await setAdminSession();
  return NextResponse.json({ ok: true });
}
