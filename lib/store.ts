import { randomUUID } from "node:crypto";
import { redis } from "./redis";
import { getProfile } from "./line";
import type { Conversation, Message, MessageSender, MessageVia } from "./types";

const INDEX_KEY = "conv:index";

const convKey = (id: string) => `conv:${id}`;
const msgKey = (id: string) => `conv:${id}:messages`;

function toConversation(id: string, raw: Record<string, unknown> | null): Conversation | null {
  if (!raw || Object.keys(raw).length === 0) return null;
  return {
    id,
    displayName: String(raw.displayName ?? "ผู้ใช้ LINE"),
    pictureUrl: String(raw.pictureUrl ?? ""),
    lastMessage: String(raw.lastMessage ?? ""),
    lastMessageAt: Number(raw.lastMessageAt ?? 0),
    unread: Number(raw.unread ?? 0),
    followed: String(raw.followed ?? "1") !== "0",
  };
}

/**
 * สร้าง/อัปเดต conversation ของ LINE user คนหนึ่ง
 * ถ้ายังไม่มีชื่อเก็บไว้จะยิง /v2/bot/profile ไปถามแค่ครั้งแรกครั้งเดียว
 * profileHint ใช้ตอน LINE Login ซึ่งได้ชื่อ+รูปมาแล้ว ไม่ต้องยิง API ซ้ำ
 */
export async function ensureConversation(
  userId: string,
  profileHint?: { displayName?: string; pictureUrl?: string },
  /**
   * ตั้งสถานะ "ยังติดตามอยู่" เป็นจริง — ส่งมาเฉพาะตอนได้ follow event เท่านั้น
   * ที่เหลือต้องรักษาค่าเดิมไว้ ไม่งั้นข้อความจากเว็บแชทหรือการล็อกอินของคนที่บล็อก OA ไปแล้ว
   * จะเขียนทับสถานะจนดูเหมือนเขายังติดตามอยู่
   */
  markFollowed = false,
): Promise<Conversation> {
  const r = redis();
  const existing = toConversation(userId, await r.hgetall(convKey(userId)));

  const needsProfile = !existing?.displayName || existing.displayName === "ผู้ใช้ LINE";
  let displayName = profileHint?.displayName ?? existing?.displayName ?? "";
  let pictureUrl = profileHint?.pictureUrl ?? existing?.pictureUrl ?? "";

  if (!profileHint && needsProfile) {
    const profile = await getProfile(userId).catch(() => null);
    if (profile) {
      displayName = profile.displayName;
      pictureUrl = profile.pictureUrl ?? "";
    }
  }

  const now = Date.now();

  /**
   * เขียนกลับเฉพาะ field ที่ฟังก์ชันนี้เป็นเจ้าของ (ตัวตนของผู้ใช้) เท่านั้น
   *
   * unread / lastMessage / lastMessageAt เป็นของ appendMessage กับ markRead
   * ถ้าเขียนค่าที่อ่านมาตั้งแต่ต้นฟังก์ชันกลับไปด้วย จะกลายเป็น read-modify-write
   * ที่ทับงานของคนอื่นที่เกิดขึ้นระหว่างนั้น เช่น ข้อความที่เพิ่งเข้ามาจะถูกย้อนกลับ
   * และตัวนับที่เพิ่ง hincrby จะหายไป
   */
  const fields: Record<string, string | number> = {
    id: userId,
    displayName: displayName || "ผู้ใช้ LINE",
    pictureUrl,
  };

  // สถานะการติดตามก็เช่นกัน — แตะเฉพาะตอนสร้างห้องใหม่หรือได้ follow event จริง
  // ไม่งั้น unfollow ที่เพิ่งมาถึงจะถูกทับด้วยค่าเก่าที่เราอ่านค้างไว้
  if (!existing || markFollowed) fields.followed = "1";

  if (!existing) {
    fields.lastMessage = "";
    fields.lastMessageAt = now;
    fields.unread = 0;
  }

  await r.hset(convKey(userId), fields);

  // ห้องเดิมอยู่ใน index อยู่แล้ว และ appendMessage เป็นคนขยับลำดับตามข้อความล่าสุด
  // ถ้า zadd ทุกครั้งที่นี่ ลำดับจะถูกย้อนกลับไปตามค่าที่อ่านมาค้างไว้
  if (!existing) {
    await r.zadd(INDEX_KEY, { score: now, member: userId });
  }

  return {
    id: userId,
    displayName: String(fields.displayName),
    pictureUrl,
    lastMessage: existing?.lastMessage ?? "",
    lastMessageAt: existing?.lastMessageAt ?? now,
    unread: existing?.unread ?? 0,
    followed: markFollowed || (existing?.followed ?? true),
  };
}

export async function appendMessage(
  userId: string,
  input: { from: MessageSender; via: MessageVia; text: string },
): Promise<Message> {
  const r = redis();
  const message: Message = {
    id: randomUUID(),
    from: input.from,
    via: input.via,
    text: input.text,
    ts: Date.now(),
  };

  await r.rpush(msgKey(userId), JSON.stringify(message));
  await r.hset(convKey(userId), {
    lastMessage: message.text.slice(0, 120),
    lastMessageAt: message.ts,
  });
  await r.zadd(INDEX_KEY, { score: message.ts, member: userId });

  // นับเฉพาะข้อความจากผู้ใช้ว่ายังไม่ได้อ่าน (ของแอดมินไม่ต้องนับ)
  if (input.from === "user") {
    await r.hincrby(convKey(userId), "unread", 1);
  }

  return message;
}

export async function markRead(userId: string): Promise<void> {
  await redis().hset(convKey(userId), { unread: 0 });
}

export async function setFollowed(userId: string, followed: boolean): Promise<void> {
  await redis().hset(convKey(userId), { followed: followed ? "1" : "0" });
}

export async function getConversation(userId: string): Promise<Conversation | null> {
  return toConversation(userId, await redis().hgetall(convKey(userId)));
}

/** รายการบทสนทนาเรียงจากที่มีข้อความใหม่สุด */
export async function listConversations(limit = 50): Promise<Conversation[]> {
  const r = redis();
  const ids = await r.zrange<string[]>(INDEX_KEY, 0, limit - 1, { rev: true });
  if (ids.length === 0) return [];

  const rows = await Promise.all(ids.map((id) => r.hgetall(convKey(id))));
  return ids
    .map((id, i) => toConversation(id, rows[i] as Record<string, unknown> | null))
    .filter((c): c is Conversation => c !== null);
}

/**
 * อ่านข้อความแบบ cursor = จำนวนข้อความที่ client มีอยู่แล้ว
 * ทำให้ polling ดึงเฉพาะส่วนที่เพิ่มมาจริง ๆ และไม่ต้องกังวลเรื่อง timestamp ชนกัน
 */
export async function getMessages(
  userId: string,
  cursor = 0,
): Promise<{ messages: Message[]; cursor: number }> {
  const r = redis();
  const total = await r.llen(msgKey(userId));
  if (cursor >= total) return { messages: [], cursor: total };

  const raw = await r.lrange<string | Message>(msgKey(userId), cursor, -1);
  const messages = raw
    .map((item) => (typeof item === "string" ? (JSON.parse(item) as Message) : item))
    .filter((m): m is Message => Boolean(m?.id));

  return { messages, cursor: total };
}

/* ---------- สถานะกำลังพิมพ์ ----------
   เก็บเป็น key ที่มี TTL สั้น ๆ ฝั่งที่พิมพ์เขียนทับทุก ๆ ไม่กี่วินาที
   พอหยุดพิมพ์ key จะหมดอายุไปเอง ไม่ต้องมี event "หยุดพิมพ์" ให้พลาด */

const TYPING_TTL_SECONDS = 6;

const typingKey = (userId: string, who: MessageSender) => `typing:${userId}:${who}`;

export async function setTyping(userId: string, who: MessageSender): Promise<void> {
  await redis().set(typingKey(userId, who), "1", { ex: TYPING_TTL_SECONDS });
}

export async function isTyping(userId: string, who: MessageSender): Promise<boolean> {
  return (await redis().exists(typingKey(userId, who))) === 1;
}
