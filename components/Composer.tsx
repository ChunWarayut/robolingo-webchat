"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const MAX_HEIGHT = 180;
const TYPING_PING_MS = 3000;

type Props = {
  onSend: (text: string) => Promise<void> | void;
  /** แจ้งว่ากำลังพิมพ์ — ถูกเรียกแบบหรี่ความถี่แล้ว ไม่ได้ยิงทุกตัวอักษร */
  onTyping?: () => void;
  disabled?: boolean;
  disabledReason?: string;
  placeholder?: string;
};

export default function Composer({ onSend, onTyping, disabled, disabledReason, placeholder }: Props) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const boxRef = useRef<HTMLDivElement>(null);
  const lastTypingPing = useRef(0);
  const lastWidth = useRef(0);

  // ขยายความสูงตามจำนวนบรรทัด แต่ไม่เกิน MAX_HEIGHT แล้วค่อยให้ scroll เอง
  const autoGrow = useCallback(() => {
    const element = textareaRef.current;
    // ถ้ายังไม่มีความกว้างจริง (แท็บพื้นหลัง/ถูกซ่อนอยู่) การวัดจะได้ค่าเพี้ยน
    // แล้วความสูงที่ตั้งเป็น inline จะค้างยาวไปจนกว่าจะพิมพ์ครั้งต่อไป
    if (!element || element.clientWidth === 0) return;

    element.style.height = "0px";
    element.style.height = `${Math.min(element.scrollHeight, MAX_HEIGHT)}px`;
  }, []);

  useEffect(() => {
    autoGrow();
  }, [text, autoGrow]);

  // วัดใหม่เมื่อความกว้างเปลี่ยน (ย่อ-ขยายหน้าต่าง, พับ sidebar, สลับมาจากแท็บพื้นหลัง)
  // เฝ้าที่กล่องครอบและเทียบความกว้างก่อน เพื่อไม่ให้การแก้ความสูงวนกลับมาเรียกตัวเอง
  useEffect(() => {
    const box = boxRef.current;
    if (!box) return;

    const observer = new ResizeObserver((entries) => {
      const width = entries[0]?.contentRect.width ?? 0;
      if (width === lastWidth.current) return;
      lastWidth.current = width;
      autoGrow();
    });

    observer.observe(box);
    return () => observer.disconnect();
  }, [autoGrow]);

  function handleChange(value: string) {
    setText(value);

    if (onTyping && value.trim().length > 0) {
      const now = Date.now();
      if (now - lastTypingPing.current > TYPING_PING_MS) {
        lastTypingPing.current = now;
        onTyping();
      }
    }
  }

  async function submit() {
    const value = text.trim();
    if (!value || busy || disabled) return;

    setBusy(true);
    setText("");
    try {
      await onSend(value);
    } finally {
      setBusy(false);
      textareaRef.current?.focus();
    }
  }

  return (
    <div className="border-t border-line bg-bg px-3 py-3 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <div
          ref={boxRef}
          className={`flex items-end gap-2 rounded-2xl border border-line bg-elevated p-2 transition focus-within:border-accent ${
            disabled ? "opacity-60" : ""
          }`}
        >
          <button
            type="button"
            disabled
            title="ยังไม่รองรับการแนบไฟล์ — ต้องต่อที่เก็บไฟล์สาธารณะก่อน LINE ถึงจะรับรูปได้"
            aria-label="แนบไฟล์ (ยังไม่รองรับ)"
            className="grid h-9 w-9 shrink-0 cursor-not-allowed place-items-center rounded-lg text-faint"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21.4 11.1 12.3 20a5.5 5.5 0 0 1-7.8-7.8l9.2-9.1a3.7 3.7 0 1 1 5.2 5.2l-9.2 9.1a1.8 1.8 0 0 1-2.6-2.6l8.5-8.4" />
            </svg>
          </button>

          <textarea
            ref={textareaRef}
            value={text}
            onChange={(event) => handleChange(event.target.value)}
            onKeyDown={(event) => {
              // Enter = ส่ง, Shift+Enter = ขึ้นบรรทัดใหม่
              if (event.key === "Enter" && !event.shiftKey) {
                event.preventDefault();
                void submit();
              }
            }}
            rows={1}
            disabled={disabled}
            placeholder={disabled ? disabledReason : (placeholder ?? "พิมพ์ข้อความ…")}
            className="max-h-[180px] min-h-9 flex-1 resize-none bg-transparent py-2 text-sm outline-none placeholder:text-faint disabled:cursor-not-allowed"
          />

          <button
            type="button"
            onClick={() => void submit()}
            disabled={disabled || busy || text.trim().length === 0}
            aria-label="ส่งข้อความ"
            className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-accent-fg transition hover:bg-accent-hover disabled:opacity-30"
          >
            {busy ? (
              <svg className="animate-spin" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <circle cx="12" cy="12" r="9" opacity="0.3" />
                <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round">
                <path d="m4 12 16-8-6 16-2.5-6.5L4 12z" />
              </svg>
            )}
          </button>
        </div>

        <p className="mt-1.5 px-1 text-[11px] text-faint">
          Enter เพื่อส่ง · Shift+Enter ขึ้นบรรทัดใหม่
        </p>
      </div>
    </div>
  );
}
