import { NextResponse } from "next/server";
import { requireEnv } from "@/lib/env";
import { clientIp, hitRateLimit, resetRateLimit } from "@/lib/rateLimit";
import { setAdminSession } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_ATTEMPTS = 10;
const WINDOW_SECONDS = 600;

export async function POST(req: Request) {
  // หน้านี้ใช้รหัสผ่านเดียวร่วมกัน ถ้าไม่จำกัดจำนวนครั้งก็เดาได้ไม่รู้จบ
  const key = `login-attempts:${clientIp(req)}`;
  const limit = await hitRateLimit(key, MAX_ATTEMPTS, WINDOW_SECONDS);

  if (!limit.allowed) {
    return NextResponse.json(
      { error: `ลองผิดบ่อยเกินไป กรุณารออีก ${Math.ceil(limit.retryAfter / 60)} นาที` },
      { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
    );
  }

  const body = (await req.json().catch(() => null)) as { password?: string } | null;

  if (!body?.password || body.password !== requireEnv("ADMIN_PASSWORD")) {
    return NextResponse.json({ error: "รหัสผ่านไม่ถูกต้อง" }, { status: 401 });
  }

  // เข้าได้แล้วให้เริ่มนับใหม่ คนที่พิมพ์ผิดไปสองสามครั้งจะได้ไม่ค้างโควตา
  await resetRateLimit(key);
  await setAdminSession();

  return NextResponse.json({ ok: true });
}
