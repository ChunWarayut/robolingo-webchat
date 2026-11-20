import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { requireEnv } from "./env";
import type { SessionUser } from "./types";

const USER_COOKIE = "rb_user";
const ADMIN_COOKIE = "rb_admin";
const OAUTH_STATE_COOKIE = "rb_oauth_state";
const WEEK_SECONDS = 60 * 60 * 24 * 7;

function secret(): Uint8Array {
  return new TextEncoder().encode(requireEnv("SESSION_SECRET"));
}

async function sign(payload: Record<string, unknown>, maxAgeSeconds: number): Promise<string> {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(`${maxAgeSeconds}s`)
    .sign(secret());
}

async function read<T>(token: string | undefined): Promise<T | null> {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    return payload as T;
  } catch {
    return null;
  }
}

const baseCookie = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  path: "/",
};

/* ---------- session ของผู้ใช้ที่ login ด้วย LINE ---------- */

export async function setUserSession(user: SessionUser): Promise<void> {
  const token = await sign({ ...user }, WEEK_SECONDS);
  (await cookies()).set(USER_COOKIE, token, { ...baseCookie, maxAge: WEEK_SECONDS });
}

export async function getUserSession(): Promise<SessionUser | null> {
  const token = (await cookies()).get(USER_COOKIE)?.value;
  const payload = await read<SessionUser & { exp: number }>(token);
  if (!payload?.userId) return null;
  return {
    userId: payload.userId,
    displayName: payload.displayName,
    pictureUrl: payload.pictureUrl,
  };
}

export async function clearUserSession(): Promise<void> {
  (await cookies()).delete(USER_COOKIE);
}

/* ---------- session ของแอดมิน (รหัสผ่านเดียวร่วมกันจาก env) ---------- */

export async function setAdminSession(): Promise<void> {
  const token = await sign({ role: "admin" }, WEEK_SECONDS);
  (await cookies()).set(ADMIN_COOKIE, token, { ...baseCookie, maxAge: WEEK_SECONDS });
}

export async function isAdmin(): Promise<boolean> {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const payload = await read<{ role?: string }>(token);
  return payload?.role === "admin";
}

export async function clearAdminSession(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
}

/* ---------- state ของ OAuth (กัน CSRF ตอน LINE Login) ---------- */

export async function setOAuthState(state: string): Promise<void> {
  (await cookies()).set(OAUTH_STATE_COOKIE, state, { ...baseCookie, maxAge: 600 });
}

export async function takeOAuthState(): Promise<string | null> {
  const store = await cookies();
  const value = store.get(OAUTH_STATE_COOKIE)?.value ?? null;
  store.delete(OAUTH_STATE_COOKIE);
  return value;
}
