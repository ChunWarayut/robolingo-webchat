import { NextResponse } from "next/server";
import { getBaseUrl, requireEnv } from "@/lib/env";
import { setUserSession, takeOAuthState } from "@/lib/session";
import { ensureConversation } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type TokenResponse = { access_token?: string; error_description?: string };
type LineLoginProfile = { userId: string; displayName: string; pictureUrl?: string };

function fail(req: Request, reason: string) {
  const url = new URL("/", getBaseUrl(req));
  url.searchParams.set("error", reason);
  return NextResponse.redirect(url);
}

export async function GET(req: Request) {
  const query = new URL(req.url).searchParams;
  const code = query.get("code");
  const returnedState = query.get("state");
  const savedState = await takeOAuthState();

  if (query.get("error")) return fail(req, query.get("error_description") ?? "ผู้ใช้ยกเลิกการเข้าสู่ระบบ");
  if (!code) return fail(req, "ไม่ได้รับ authorization code");
  if (!returnedState || returnedState !== savedState) return fail(req, "state ไม่ตรงกัน");

  // แลก code เป็น access token
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: `${getBaseUrl(req)}/api/auth/line/callback`,
      client_id: requireEnv("LINE_LOGIN_CHANNEL_ID"),
      client_secret: requireEnv("LINE_LOGIN_CHANNEL_SECRET"),
    }),
  });

  const token = (await tokenRes.json()) as TokenResponse;
  if (!tokenRes.ok || !token.access_token) {
    return fail(req, token.error_description ?? "แลก token ไม่สำเร็จ");
  }

  // ดึงโปรไฟล์ของคนที่เพิ่ง login
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${token.access_token}` },
  });
  if (!profileRes.ok) return fail(req, "ดึงโปรไฟล์ไม่สำเร็จ");
  const profile = (await profileRes.json()) as LineLoginProfile;

  await setUserSession({
    userId: profile.userId,
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl ?? "",
  });

  // ให้โผล่ในหน้า inbox ของแอดมินทันทีแม้ยังไม่พิมพ์อะไร
  await ensureConversation(profile.userId, {
    displayName: profile.displayName,
    pictureUrl: profile.pictureUrl ?? "",
  });

  return NextResponse.redirect(new URL("/", getBaseUrl(req)));
}
