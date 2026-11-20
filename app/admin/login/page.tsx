"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import ThemeToggle from "@/components/ThemeToggle";

export default function AdminLoginPage() {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setError(null);

    try {
      const res = await fetch("/api/admin/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setError(data?.error ?? "เข้าสู่ระบบไม่สำเร็จ");
        return;
      }

      router.push("/admin");
      router.refresh();
    } catch {
      setError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex h-[100dvh] flex-col bg-bg text-fg">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-24">
        <form onSubmit={submit} className="w-full max-w-sm">
          <div className="mb-6 text-center">
            <h1 className="text-lg font-semibold tracking-tight">เข้าสู่ระบบทีมงาน</h1>
            <p className="mt-1.5 text-[13px] text-muted">ใส่รหัสผ่านเพื่อเปิดกล่องข้อความ</p>
          </div>

          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoFocus
            placeholder="รหัสผ่าน"
            className="h-11 w-full rounded-xl border border-line bg-elevated px-3.5 text-sm outline-none transition focus:border-accent placeholder:text-faint"
          />

          {error && <p className="mt-2.5 text-center text-xs text-danger">{error}</p>}

          <button
            type="submit"
            disabled={busy || password.length === 0}
            className="mt-4 flex h-11 w-full items-center justify-center rounded-xl bg-accent text-sm font-medium text-accent-fg transition hover:bg-accent-hover disabled:opacity-40"
          >
            {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
          </button>
        </form>
      </div>
    </main>
  );
}
