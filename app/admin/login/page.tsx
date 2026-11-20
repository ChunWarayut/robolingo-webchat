"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

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
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
      <form
        onSubmit={submit}
        className="w-full max-w-sm rounded-2xl bg-white p-8 shadow-xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700"
      >
        <h1 className="text-lg font-semibold">เข้าสู่ระบบทีมงาน</h1>
        <p className="mt-2 text-sm text-neutral-500">ใส่รหัสผ่านเพื่อเข้าหน้ากล่องข้อความ</p>

        <input
          type="password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          autoFocus
          placeholder="รหัสผ่าน"
          className="mt-5 w-full rounded-xl border border-neutral-300 px-3 py-2 text-sm outline-none focus:border-[#06C755] dark:border-neutral-600 dark:bg-neutral-800"
        />

        {error && <p className="mt-3 text-xs text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={busy || password.length === 0}
          className="mt-5 w-full rounded-xl bg-[#06C755] px-4 py-2.5 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-40"
        >
          {busy ? "กำลังตรวจสอบ…" : "เข้าสู่ระบบ"}
        </button>
      </form>
    </main>
  );
}
