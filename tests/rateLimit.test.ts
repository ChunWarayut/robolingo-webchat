import { beforeEach, describe, expect, it, vi } from "vitest";

const incr = vi.fn();
const expire = vi.fn();
const ttl = vi.fn();
const del = vi.fn();

vi.mock("@/lib/redis", () => ({
  redis: () => ({ incr, expire, ttl, del }),
}));

const { hitRateLimit, clientIp } = await import("@/lib/rateLimit");

describe("hitRateLimit", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    ttl.mockResolvedValue(120);
  });

  it("สั่งตั้ง TTL แบบ NX ทุกครั้ง เพื่อให้ key ที่ TTL หลุดไปกู้คืนได้เอง", async () => {
    incr.mockResolvedValue(1);
    await hitRateLimit("k", 10, 600);
    expect(expire).toHaveBeenCalledWith("k", 600, "NX");

    // ครั้งต่อไปก็ยังสั่ง เพราะ NX ทำให้ Redis ไม่ขยับ TTL ที่ตั้งไว้แล้ว
    // หน้าต่างเวลาจึงยังเริ่มนับจากความพยายามครั้งแรกเหมือนเดิม
    incr.mockResolvedValue(2);
    await hitRateLimit("k", 10, 600);
    expect(expire).toHaveBeenCalledTimes(2);
  });

  it("ยังผ่านเมื่อนับได้เท่ากับเพดานพอดี", async () => {
    incr.mockResolvedValue(10);
    await expect(hitRateLimit("k", 10, 600)).resolves.toMatchObject({ allowed: true, remaining: 0 });
  });

  it("ไม่ผ่านเมื่อเกินเพดาน และบอกเวลาที่ต้องรอจาก TTL จริง", async () => {
    incr.mockResolvedValue(11);
    await expect(hitRateLimit("k", 10, 600)).resolves.toMatchObject({ allowed: false, retryAfter: 120 });
  });

  it("ปล่อยผ่านเมื่อ Redis ล่ม — ไม่ล็อกทุกคนออกเพราะที่เก็บสถิติพัง", async () => {
    incr.mockRejectedValue(new Error("redis ล่ม"));
    vi.spyOn(console, "error").mockImplementation(() => {});

    await expect(hitRateLimit("k", 10, 600)).resolves.toMatchObject({ allowed: true });
  });
});

describe("clientIp", () => {
  it("ใช้ค่าแรกของ x-forwarded-for ซึ่งเป็น IP ของผู้เรียกจริง", () => {
    const req = new Request("https://example.com", {
      headers: { "x-forwarded-for": "203.0.113.9, 70.41.3.18" },
    });
    expect(clientIp(req)).toBe("203.0.113.9");
  });

  it("ถอยไปใช้ x-real-ip แล้วค่อยเป็น unknown", () => {
    expect(clientIp(new Request("https://e.com", { headers: { "x-real-ip": "198.51.100.7" } }))).toBe("198.51.100.7");
    expect(clientIp(new Request("https://e.com"))).toBe("unknown");
  });
});
