import { describe, expect, it } from "vitest";
import {
  createPendingMessage,
  markFailed,
  mergeMessages,
  settlePending,
  type ChatMessage,
} from "@/components/chatTypes";
import type { Message } from "@/lib/types";

function message(id: string, text: string, ts: number, from: Message["from"] = "user"): Message {
  return { id, from, via: "line", text, ts };
}

describe("mergeMessages", () => {
  it("ต่อข้อความใหม่ท้ายรายการเดิม", () => {
    const current: ChatMessage[] = [message("a", "หนึ่ง", 1)];
    const merged = mergeMessages(current, [message("b", "สอง", 2)]);

    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("ข้าม id ที่มีอยู่แล้ว — กันเคส request ซ้อนกันแล้วอ่าน cursor ค่าเดิม", () => {
    const current: ChatMessage[] = [message("a", "หนึ่ง", 1)];
    const merged = mergeMessages(current, [message("a", "หนึ่ง", 1), message("b", "สอง", 2)]);

    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });

  it("คืนอาเรย์เดิมเมื่อไม่มีอะไรใหม่ จะได้ไม่ re-render เปล่า ๆ", () => {
    const current: ChatMessage[] = [message("a", "หนึ่ง", 1)];

    expect(mergeMessages(current, [])).toBe(current);
    expect(mergeMessages(current, [message("a", "หนึ่ง", 1)])).toBe(current);
  });

  it("ทิ้ง bubble ชั่วคราวเมื่อข้อความจริงที่ตรงกันถูกดึงมาก่อน", () => {
    const pending = createPendingMessage("user", "web", "ส่งอยู่");
    const merged = mergeMessages([pending], [message("real", "ส่งอยู่", pending.ts + 5)]);

    expect(merged).toHaveLength(1);
    expect(merged[0].id).toBe("real");
  });

  it("ไม่ทิ้ง bubble ชั่วคราวที่ข้อความไม่ตรงกัน", () => {
    const pending = createPendingMessage("user", "web", "ของฉัน");
    const merged = mergeMessages([pending], [message("real", "ของคนอื่น", pending.ts + 5)]);

    expect(merged.map((m) => m.id)).toEqual([pending.id, "real"]);
  });

  it("เรียงตามเวลา แม้ข้อความที่ดึงมาจะเก่ากว่าที่มีอยู่", () => {
    const current: ChatMessage[] = [message("b", "สอง", 20)];
    const merged = mergeMessages(current, [message("a", "หนึ่ง", 10)]);

    expect(merged.map((m) => m.id)).toEqual(["a", "b"]);
  });
});

describe("settlePending", () => {
  it("แทน bubble ชั่วคราวด้วยข้อความจริง", () => {
    const pending = createPendingMessage("admin", "line", "ตอบแล้ว");
    const settled = settlePending([pending], pending.id, message("real", "ตอบแล้ว", pending.ts, "admin"));

    expect(settled).toHaveLength(1);
    expect(settled[0].id).toBe("real");
    expect(settled[0].status).toBeUndefined();
  });

  it("เอา bubble ชั่วคราวออกเฉย ๆ ถ้า polling ดึงข้อความจริงมาก่อนแล้ว", () => {
    const pending = createPendingMessage("admin", "line", "ตอบแล้ว");
    const confirmed = message("real", "ตอบแล้ว", pending.ts, "admin");
    const settled = settlePending([confirmed, pending], pending.id, confirmed);

    expect(settled.map((m) => m.id)).toEqual(["real"]);
  });
});

describe("markFailed", () => {
  it("ตั้งสถานะล้มเหลวเฉพาะข้อความที่ระบุ", () => {
    const first = createPendingMessage("user", "web", "หนึ่ง");
    const second = createPendingMessage("user", "web", "สอง");
    const marked = markFailed([first, second], second.id);

    expect(marked[0].status).toBe("sending");
    expect(marked[1].status).toBe("failed");
  });
});
