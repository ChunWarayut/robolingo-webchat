import type { Message } from "@/lib/types";

/**
 * ต่อข้อความใหม่ท้ายรายการเดิมโดยข้ามตัวที่มีอยู่แล้ว
 * ด่านที่สองถัดจากการกัน request ซ้อน — ต่อให้มี path ไหนยิงซ้ำ ข้อความก็จะไม่ขึ้นสองรอบ
 */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const seen = new Set(current.map((message) => message.id));
  const fresh = incoming.filter((message) => !seen.has(message.id));
  return fresh.length > 0 ? [...current, ...fresh] : current;
}
