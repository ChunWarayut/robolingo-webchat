"use client";

import type { ReactNode } from "react";
import Avatar from "./Avatar";
import BrandMark from "./BrandMark";
import ThemeToggle from "./ThemeToggle";

type Props = {
  title: string;
  avatarUrl?: string;
  /** ใช้สัญลักษณ์ของ OA แทนรูปโปรไฟล์ (หน้าที่ผู้ใช้คุยกับทีมงาน) */
  brand?: boolean;
  /** จุดสีเขียว/เทา พร้อมข้อความสถานะใต้ชื่อ */
  online: boolean;
  statusText: string;
  subtitle?: string;
  leading?: ReactNode;
  trailing?: ReactNode;
};

export default function ChatHeader({
  title,
  avatarUrl,
  brand = false,
  online,
  statusText,
  subtitle,
  leading,
  trailing,
}: Props) {
  return (
    <header className="sticky top-0 z-20 flex shrink-0 items-center gap-3 border-b border-line bg-bg/85 px-3 py-2.5 backdrop-blur-md sm:px-5">
      {leading}

      {brand ? <BrandMark size={36} /> : <Avatar src={avatarUrl} alt="" size={36} />}

      <div className="min-w-0 flex-1">
        <p className="truncate text-[13.5px] font-medium">{title}</p>
        <p className="flex items-center gap-1.5 truncate text-[11px] text-muted">
          <span
            className={`h-1.5 w-1.5 shrink-0 rounded-full ${online ? "bg-online" : "bg-faint"}`}
            aria-hidden
          />
          {statusText}
          {subtitle && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate">{subtitle}</span>
            </>
          )}
        </p>
      </div>

      {trailing}
      <ThemeToggle />
    </header>
  );
}
