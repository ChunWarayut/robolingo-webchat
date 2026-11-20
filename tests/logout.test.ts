import { describe, expect, it, vi } from "vitest";

const clearAdminSession = vi.fn(async () => {});
const clearUserSession = vi.fn(async () => {});

vi.mock("@/lib/session", () => ({ clearAdminSession, clearUserSession }));

const { POST } = await import("@/app/api/auth/logout/route");

function logoutRequest(query = "") {
  return new Request(`https://example.test/api/auth/logout${query}`, {
    method: "POST",
    headers: { host: "example.test" },
  });
}

describe("POST /api/auth/logout", () => {
  /**
   * 307 (ค่าเริ่มต้นของ NextResponse.redirect) สั่งให้เบราว์เซอร์ทำซ้ำด้วย method เดิม
   * ปลายทางจึงกลายเป็น POST ไปหน้าเว็บ การนำทางไม่สำเร็จ และผู้ใช้ค้างอยู่หน้าเดิม
   * ทั้งที่ cookie ถูกลบไปแล้ว — ต้องเป็น 303 เท่านั้น
   */
  it("ตอบ 303 เพื่อให้เบราว์เซอร์เปลี่ยนเป็น GET ตอนไปต่อ", async () => {
    expect((await POST(logoutRequest("?scope=admin"))).status).toBe(303);
    expect((await POST(logoutRequest())).status).toBe(303);
  });

  it("แอดมินถูกส่งไปหน้าเข้าสู่ระบบทีมงาน และเคลียร์เฉพาะเซสชันแอดมิน", async () => {
    clearAdminSession.mockClear();
    clearUserSession.mockClear();

    const res = await POST(logoutRequest("?scope=admin"));

    expect(res.headers.get("location")).toBe("https://example.test/admin/login");
    expect(clearAdminSession).toHaveBeenCalledTimes(1);
    expect(clearUserSession).not.toHaveBeenCalled();
  });

  it("ผู้ใช้ถูกส่งกลับหน้าแรก และเคลียร์เฉพาะเซสชันผู้ใช้", async () => {
    clearAdminSession.mockClear();
    clearUserSession.mockClear();

    const res = await POST(logoutRequest());

    expect(res.headers.get("location")).toBe("https://example.test/");
    expect(clearUserSession).toHaveBeenCalledTimes(1);
    expect(clearAdminSession).not.toHaveBeenCalled();
  });
});
