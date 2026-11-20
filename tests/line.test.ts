import crypto from "node:crypto";
import { beforeAll, describe, expect, it } from "vitest";
import { verifySignature } from "@/lib/line";

const SECRET = "test-channel-secret";

function sign(body: string, secret = SECRET): string {
  return crypto.createHmac("sha256", secret).update(body).digest("base64");
}

beforeAll(() => {
  process.env.LINE_CHANNEL_SECRET = SECRET;
});

describe("verifySignature", () => {
  const body = JSON.stringify({ events: [{ type: "message" }] });

  it("ผ่านเมื่อลายเซ็นตรงกับ raw body", () => {
    expect(verifySignature(body, sign(body))).toBe(true);
  });

  it("ไม่ผ่านเมื่อไม่มี header", () => {
    expect(verifySignature(body, null)).toBe(false);
  });

  it("ไม่ผ่านเมื่อลายเซ็นมั่ว", () => {
    expect(verifySignature(body, "ไม่ใช่ลายเซ็น")).toBe(false);
  });

  it("ไม่ผ่านเมื่อเซ็นด้วย secret อื่น", () => {
    expect(verifySignature(body, sign(body, "secret-อื่น"))).toBe(false);
  });

  it("ไม่ผ่านเมื่อ body ถูกแก้แม้แต่ตัวอักษรเดียว", () => {
    const signature = sign(body);
    expect(verifySignature(`${body} `, signature)).toBe(false);
  });

  it("ไม่ผ่านเมื่อลายเซ็นยาวไม่เท่ากัน (ต้องไม่ throw จาก timingSafeEqual)", () => {
    expect(() => verifySignature(body, "c2hvcnQ=")).not.toThrow();
    expect(verifySignature(body, "c2hvcnQ=")).toBe(false);
  });

  it("ลายเซ็นของ body ว่าง ซึ่งเป็นเคสที่ปุ่ม Verify ของ LINE ใช้", () => {
    const verifyBody = JSON.stringify({ events: [] });
    expect(verifySignature(verifyBody, sign(verifyBody))).toBe(true);
  });
});
