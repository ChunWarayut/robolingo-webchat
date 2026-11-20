import type { Message } from "@/lib/types";

/** ข้อความฝั่ง client มีสถานะระหว่างส่งเพิ่มเข้ามาจากของที่เก็บในเซิร์ฟเวอร์ */
export type ChatMessage = Message & { status?: "sending" | "failed" };

export function createPendingMessage(
  from: Message["from"],
  via: Message["via"],
  text: string,
): ChatMessage {
  return {
    id: `tmp-${Math.random().toString(36).slice(2)}-${Date.now()}`,
    from,
    via,
    text,
    ts: Date.now(),
    status: "sending",
  };
}

/**
 * ต่อข้อความใหม่ท้ายรายการเดิมโดยข้ามตัวที่มีอยู่แล้ว
 * ด่านที่สองถัดจากการกัน request ซ้อน — ต่อให้มี path ไหนยิงซ้ำ ข้อความก็จะไม่ขึ้นสองรอบ
 *
 * ถ้า polling ดึงข้อความจริงมาก่อนที่ POST จะตอบกลับ bubble ชั่วคราวจะถูกทิ้ง
 * โดยดูจากผู้ส่ง+ข้อความที่ตรงกัน ไม่งั้นจะเห็นข้อความเดียวกันสองอันแวบหนึ่ง
 */
export function mergeMessages(current: ChatMessage[], incoming: Message[]): ChatMessage[] {
  if (incoming.length === 0) return current;

  const seen = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  if (fresh.length === 0) return current;

  const confirmed = new Set(fresh.map((message) => `${message.from}:${message.text}`));
  const withoutSettledPending = current.filter(
    (message) => message.status !== "sending" || !confirmed.has(`${message.from}:${message.text}`),
  );

  return [...withoutSettledPending, ...fresh].sort((a, b) => a.ts - b.ts);
}

/**
 * แทน bubble ชั่วคราวด้วยข้อความจริงที่เซิร์ฟเวอร์ตอบกลับมา
 * ถ้า polling ชิงดึงข้อความนั้นมาก่อนแล้ว ก็แค่เอา bubble ชั่วคราวออกเฉย ๆ
 */
export function settlePending(
  current: ChatMessage[],
  pendingId: string,
  confirmed: Message,
): ChatMessage[] {
  const alreadyThere = current.some((message) => message.id === confirmed.id);
  const withoutPending = current.filter((message) => message.id !== pendingId);

  return (alreadyThere ? withoutPending : [...withoutPending, confirmed]).sort((a, b) => a.ts - b.ts);
}

export function markFailed(current: ChatMessage[], pendingId: string): ChatMessage[] {
  return current.map((message) =>
    message.id === pendingId ? { ...message, status: "failed" as const } : message,
  );
}
