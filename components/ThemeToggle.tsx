"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

const THEME_EVENT = "rb-theme-change";

function subscribe(onChange: () => void): () => void {
  const media = window.matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);

  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

/** ธีมที่กำลังแสดงจริง = ค่าที่ผู้ใช้เลือกไว้ ถ้าไม่เคยเลือกก็ตามระบบ */
function getSnapshot(): Theme {
  const chosen = document.documentElement.getAttribute("data-theme");
  if (chosen === "light" || chosen === "dark") return chosen;
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

export default function ThemeToggle({ className = "" }: { className?: string }) {
  // ฝั่ง server ไม่รู้ว่าเครื่องผู้ใช้ตั้งธีมอะไรไว้ จึงคืน null แล้วค่อยวาดปุ่มจริงตอน hydrate
  const theme = useSyncExternalStore(subscribe, getSnapshot, () => null);

  function toggle() {
    const next: Theme = theme === "dark" ? "light" : "dark";
    document.documentElement.setAttribute("data-theme", next);
    try {
      localStorage.setItem("rb-theme", next);
    } catch {
      // โหมดส่วนตัวของเบราว์เซอร์อาจห้ามเขียน — เปลี่ยนธีมได้อยู่ แค่ไม่จำข้ามรอบ
    }
    window.dispatchEvent(new Event(THEME_EVENT));
  }

  const base = `grid h-9 w-9 shrink-0 place-items-center rounded-lg border border-line text-muted transition hover:bg-elevated hover:text-fg ${className}`;

  if (!theme) return <div className={base} aria-hidden />;

  return (
    <button
      type="button"
      onClick={toggle}
      className={base}
      aria-label={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
      title={theme === "dark" ? "สลับเป็นโหมดสว่าง" : "สลับเป็นโหมดมืด"}
    >
      {theme === "dark" ? (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
        </svg>
      ) : (
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
        </svg>
      )}
    </button>
  );
}
