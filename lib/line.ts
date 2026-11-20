import crypto from "node:crypto";
import { requireEnv } from "./env";

const API = "https://api.line.me";

export type LineProfile = {
  userId: string;
  displayName: string;
  pictureUrl?: string;
  statusMessage?: string;
};

/**
 * ตรวจลายเซ็นของ webhook: HMAC-SHA256 ของ "raw body" ด้วย channel secret แล้วเทียบแบบ timing-safe
 * สำคัญ: ต้องส่ง raw string ที่อ่านจาก req.text() เข้ามา ห้าม JSON.stringify ของที่ parse แล้ว
 * เพราะลำดับ/ช่องว่างจะเปลี่ยนและลายเซ็นจะไม่ตรง
 */
export function verifySignature(rawBody: string, signature: string | null): boolean {
  if (!signature) return false;

  const expected = crypto
    .createHmac("sha256", requireEnv("LINE_CHANNEL_SECRET"))
    .update(rawBody)
    .digest("base64");

  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

async function lineFetch(path: string, init: RequestInit): Promise<Response> {
  return fetch(`${API}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${requireEnv("LINE_CHANNEL_ACCESS_TOKEN")}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });
}

/** ส่งข้อความหา user แบบ push (นับโควตาของ OA) */
export async function pushMessage(to: string, text: string): Promise<void> {
  const res = await lineFetch("/v2/bot/message/push", {
    method: "POST",
    body: JSON.stringify({ to, messages: [{ type: "text", text }] }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LINE push ล้มเหลว (${res.status}): ${detail}`);
  }
}

/** ตอบด้วย replyToken — ฟรี ไม่นับโควตา แต่ token ใช้ได้ครั้งเดียวและหมดอายุเร็ว */
export async function replyMessage(replyToken: string, text: string): Promise<void> {
  const res = await lineFetch("/v2/bot/message/reply", {
    method: "POST",
    body: JSON.stringify({ replyToken, messages: [{ type: "text", text }] }),
  });

  if (!res.ok) {
    const detail = await res.text();
    throw new Error(`LINE reply ล้มเหลว (${res.status}): ${detail}`);
  }
}

/** ดึงชื่อ + รูปโปรไฟล์ของ user ที่เป็นเพื่อนกับ OA */
export async function getProfile(userId: string): Promise<LineProfile | null> {
  const res = await lineFetch(`/v2/bot/profile/${encodeURIComponent(userId)}`, { method: "GET" });
  if (!res.ok) return null;
  return (await res.json()) as LineProfile;
}
