"use client";

import { useState } from "react";

type Props = {
  onSend: (text: string) => Promise<void>;
  disabled?: boolean;
  placeholder?: string;
};

export default function Composer({ onSend, disabled, placeholder }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    const value = text.trim();
    if (!value || busy || disabled) return;

    setBusy(true);
    try {
      await onSend(value);
      setText("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-end gap-2 border-t border-neutral-200 p-3 dark:border-neutral-700">
      <textarea
        value={text}
        onChange={(event) => setText(event.target.value)}
        onKeyDown={(event) => {
          // Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void submit();
          }
        }}
        rows={1}
        disabled={disabled || busy}
        placeholder={placeholder ?? "พิมพ์ข้อความ…"}
        className="max-h-32 flex-1 resize-none rounded-xl border border-neutral-300 bg-white px-3 py-2 text-sm outline-none focus:border-[#06C755] disabled:opacity-50 dark:border-neutral-600 dark:bg-neutral-800"
      />
      <button
        type="button"
        onClick={() => void submit()}
        disabled={disabled || busy || text.trim().length === 0}
        className="rounded-xl bg-[#06C755] px-4 py-2 text-sm font-medium text-white transition hover:brightness-95 disabled:opacity-40"
      >
        {busy ? "กำลังส่ง…" : "ส่ง"}
      </button>
    </div>
  );
}
