import { beforeEach, describe, expect, it, vi } from "vitest";

/** Redis จำลองแบบเก็บใน memory เท่าที่ ensureConversation ใช้ */
const hashes = new Map<string, Record<string, string>>();

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
  }),
}));

vi.mock("@/lib/line", () => ({
  getProfile: async () => ({ userId: "U1", displayName: "ดึงจาก LINE", pictureUrl: "" }),
}));

const { ensureConversation, setFollowed, getConversation } = await import("@/lib/store");

const USER = "U00000000000000000000000000000001";

describe("ensureConversation กับสถานะการติดตาม", () => {
  beforeEach(() => {
    hashes.clear();
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
