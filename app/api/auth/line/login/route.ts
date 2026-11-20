import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { getBaseUrl, requireEnv } from "@/lib/env";
import { setOAuthState } from "@/lib/session";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const state = randomUUID();
  await setOAuthState(state);

  const params = new URLSearchParams({
    response_type: "code",
    client_id: requireEnv("LINE_LOGIN_CHANNEL_ID"),
    redirect_uri: `${getBaseUrl(req)}/api/auth/line/callback`,
    state,
    scope: "profile openid",
    // ชวนให้เพิ่ม OA เป็นเพื่อนตอน login — ถ้าไม่เป็นเพื่อน push หาเขาไม่ได้
    bot_prompt: "aggressive",
  });

  // URLSearchParams เข้ารหัสช่องว่างเป็น "+" แต่ตัวอย่างของ LINE ใช้ %20 — แปลงให้ตรงกันไว้ก่อน
  const query = params.toString().replace(/\+/g, "%20");

  return NextResponse.redirect(`https://access.line.me/oauth2/v2.1/authorize?${query}`);
}
