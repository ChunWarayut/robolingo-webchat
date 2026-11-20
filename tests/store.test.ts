import { beforeEach, describe, expect, it, vi } from "vitest";

/** Redis จำลองแบบเก็บใน memory เท่าที่ store ใช้ */
const hashes = new Map<string, Record<string, string>>();
const lists = new Map<string, string[]>();

const zadd = vi.fn(async () => 1);

vi.mock("@/lib/redis", () => ({
  redis: () => ({
    hgetall: async (key: string) => hashes.get(key) ?? null,
    hset: async (key: string, value: Record<string, unknown>) => {
      const current = hashes.get(key) ?? {};
      for (const [field, raw] of Object.entries(value)) current[field] = String(raw);
      hashes.set(key, current);
      return 1;
    },
    zadd,
    lrange: async (key: string, start: number, stop: number) => {
      const list = lists.get(key) ?? [];
      // เลียนแบบ Redis จริง: index ติดลบคือนับจากท้ายรายการ
      const from = start < 0 ? Math.max(list.length + start, 0) : start;
      const to = stop < 0 ? list.length + stop : stop;
      return list.slice(from, to + 1);
    },
  }),
}));

vi.mock("@/lib/line", () => ({
  getProfile: async () => ({ userId: "U1", displayName: "ดึงจาก LINE", pictureUrl: "" }),
}));

const { ensureConversation, setFollowed, getConversation, getMessages } = await import("@/lib/store");

const USER = "U00000000000000000000000000000001";

describe("ensureConversation กับสถานะการติดตาม", () => {
  beforeEach(() => {
    hashes.clear();
    lists.clear();
    zadd.mockClear();
  });

  it("ห้องใหม่ถือว่ายังติดตามอยู่", async () => {
    const conversation = await ensureConversation(USER, { displayName: "ก" });
    expect(conversation.followed).toBe(true);
  });

  it("ไม่เขียนทับสถานะของคนที่บล็อก OA ไปแล้ว", async () => {
    await ensureConversation(USER, { displayName: "ก" });
    await setFollowed(USER, false);

    // จำลองการส่งข้อความจากเว็บแชทหลังบล็อก — ต้องไม่ทำให้กลับมาเป็นติดตาม
    const afterWebMessage = await ensureConversation(USER, { displayName: "ก" });

    expect(afterWebMessage.followed).toBe(false);
    expect((await getConversation(USER))?.followed).toBe(false);
  });

  it("ไม่เขียนทับตัวนับที่ยังไม่ได้อ่านและข้อความล่าสุดของห้องเดิม", async () => {
    await ensureConversation(USER, { displayName: "ก" });

    // จำลองว่า appendMessage ทำงานแทรกเข้ามาระหว่างที่เราถืออ่านค่าเก่าไว้
    const row = hashes.get(`conv:${USER}`)!;
    row.unread = "3";
    row.lastMessage = "ข้อความล่าสุด";
    row.lastMessageAt = "999";

    await ensureConversation(USER, { displayName: "ก" });

    const after = hashes.get(`conv:${USER}`)!;
    expect(after.unread).toBe("3");
    expect(after.lastMessage).toBe("ข้อความล่าสุด");
    expect(after.lastMessageAt).toBe("999");
  });

  it("ขยับลำดับใน index เฉพาะตอนสร้างห้องใหม่ ไม่ใช่ทุกครั้งที่ถูกเรียก", async () => {
    await ensureConversation(USER, { displayName: "ก" });
    expect(zadd).toHaveBeenCalledTimes(1);

    await ensureConversation(USER, { displayName: "ก" });
    await ensureConversation(USER, undefined, true);
    expect(zadd).toHaveBeenCalledTimes(1);
  });

  it("กลับมาติดตามเมื่อได้ follow event เท่านั้น", async () => {
    await ensureConversation(USER, { displayName: "ก" });
    await setFollowed(USER, false);

    const afterFollowEvent = await ensureConversation(USER, undefined, true);

    expect(afterFollowEvent.followed).toBe(true);
    expect((await getConversation(USER))?.followed).toBe(true);
  });
});


describe("getMessages", () => {
  const key = `conv:${USER}:messages`;

  function seed(count: number) {
    lists.set(
      key,
      Array.from({ length: count }, (_, index) =>
        JSON.stringify({ id: `m${index}`, from: "user", via: "line", text: `ข้อความ ${index}`, ts: index }),
      ),
    );
  }

  beforeEach(() => {
    lists.clear();
  });

  it("ดึงเฉพาะส่วนที่เพิ่มมาหลัง cursor", async () => {
    seed(5);
    const result = await getMessages(USER, 3);

    expect(result.messages.map((m) => m.id)).toEqual(["m3", "m4"]);
    expect(result.cursor).toBe(5);
  });

  it("cursor ติดลบต้องไม่กลายเป็นการนับจากท้ายรายการจนประวัติหาย", async () => {
    seed(5);
    const result = await getMessages(USER, -3);

    // ต้องได้ทั้งเธรดตั้งแต่ต้น ไม่ใช่แค่ 3 อันท้าย
    expect(result.messages.map((m) => m.id)).toEqual(["m0", "m1", "m2", "m3", "m4"]);
    expect(result.cursor).toBe(5);
  });

  it("cursor ที่ไม่ใช่จำนวนเต็มหรือไม่ใช่ตัวเลข ถือเป็นเริ่มจากศูนย์", async () => {
    seed(3);

    expect((await getMessages(USER, 1.7)).messages.map((m) => m.id)).toEqual(["m1", "m2"]);
    expect((await getMessages(USER, Number.NaN)).messages).toHaveLength(3);
  });

  it("ไม่มีอะไรใหม่ ต้องคืน cursor เดิมไม่ถอยหลัง", async () => {
    seed(4);
    const result = await getMessages(USER, 4);

    expect(result.messages).toHaveLength(0);
    expect(result.cursor).toBe(4);
  });

  it("แถวที่เสียต้องไม่ทำให้ทั้งเธรดพัง และต้องไม่ถูกดึงซ้ำรอบหน้า", async () => {
    seed(2);
    lists.get(key)!.push("ไม่ใช่ JSON");

    const result = await getMessages(USER, 0);

    expect(result.messages.map((m) => m.id)).toEqual(["m0", "m1"]);
    // ขยับตามจำนวนแถวที่อ่านมา (3) ไม่ใช่จำนวนที่ parse ผ่าน (2)
    expect(result.cursor).toBe(3);
  });
});
