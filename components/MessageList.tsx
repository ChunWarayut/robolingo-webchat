"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage } from "./chatTypes";
import Avatar from "./Avatar";
import BrandMark from "./BrandMark";
import TypingDots from "./TypingDots";
import { MessageSkeleton } from "./Skeletons";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function dayLabel(ts: number): string {
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const today = startOfToday.getTime();

  if (ts >= today) return "วันนี้";
  if (ts >= today - 86_400_000) return "เมื่อวาน";
  return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "long", year: "numeric" });
}

type Props = {
  messages: ChatMessage[];
  /** ใครกำลังดู — ข้อความของคนนี้จะชิดขวาและเป็นสีคราม */
  viewer: "user" | "admin";
  peerName: string;
  peerAvatar?: string;
  /** คู่สนทนาคือ LINE OA ไม่ใช่คน — ใช้สัญลักษณ์แทนรูปโปรไฟล์ */
  peerBrand?: boolean;
  peerTyping?: boolean;
  loading?: boolean;
  emptyTitle: string;
  emptyHint: string;
  onRetry?: (message: ChatMessage) => void;
};

export default function MessageList({
  messages,
  viewer,
  peerName,
  peerAvatar,
  peerBrand = false,
  peerTyping = false,
  loading = false,
  emptyTitle,
  emptyHint,
  onRetry,
}: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  // เลื่อนลงล่างอัตโนมัติเฉพาะตอนที่ผู้ใช้อยู่ใกล้ล่างอยู่แล้ว
  // ไม่งั้นข้อความใหม่จะกระชากหน้าจอขณะเขากำลังอ่านย้อนหลัง
  const pinnedToBottom = useRef(true);

  useEffect(() => {
    const element = scrollRef.current;
    if (!element) return;

    function onScroll() {
      if (!element) return;
      const distance = element.scrollHeight - element.scrollTop - element.clientHeight;
      pinnedToBottom.current = distance < 120;
    }

    element.addEventListener("scroll", onScroll, { passive: true });
    return () => element.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (pinnedToBottom.current) {
      bottomRef.current?.scrollIntoView({ block: "end" });
    }
  }, [messages.length, peerTyping]);

  if (loading) return <MessageSkeleton />;

  if (messages.length === 0 && !peerTyping) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
        <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-elevated text-muted">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.1A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium">{emptyTitle}</p>
        <p className="max-w-xs text-xs whitespace-pre-line text-muted">{emptyHint}</p>
      </div>
    );
  }

  return (
    <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-4 sm:px-6">
      <div className="mx-auto flex max-w-3xl flex-col gap-3">
        {messages.map((message, index) => {
          const mine = message.from === viewer;
          const day = dayLabel(message.ts);
          // ขึ้นเส้นคั่นวันเมื่อข้ามวันจากข้อความก่อนหน้า
          const showDay = index === 0 || dayLabel(messages[index - 1].ts) !== day;

          return (
            <div key={message.id} className="contents">
              {showDay && (
                <div className="my-2 flex items-center gap-3">
                  <span className="h-px flex-1 bg-line" />
                  <span className="text-[11px] text-faint">{day}</span>
                  <span className="h-px flex-1 bg-line" />
                </div>
              )}

              <div className={`flex items-end gap-2.5 ${mine ? "justify-end" : "justify-start"}`}>
                {!mine &&
                  (peerBrand ? (
                    <span className="mb-5">
                      <BrandMark size={28} />
                    </span>
                  ) : (
                    <Avatar src={peerAvatar} alt={peerName} size={28} className="mb-5" />
                  ))}

                <div className={`flex min-w-0 max-w-[85%] flex-col gap-1 sm:max-w-[72%] ${mine ? "items-end" : "items-start"}`}>
                  <div
                    className={`min-w-0 rounded-2xl px-3.5 py-2.5 ${
                      mine
                        ? "bg-accent text-accent-fg rounded-br-sm"
                        : "bg-bubble-peer text-fg border border-line rounded-bl-sm"
                    } ${message.status === "failed" ? "opacity-60" : ""}`}
                  >
                    <p className="text-[14px] leading-relaxed whitespace-pre-wrap break-words">
                      {message.text}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5 px-1 text-[11px] text-faint">
                    <span>{formatTime(message.ts)}</span>
                    <span aria-hidden>·</span>
                    <span>{message.via === "web" ? "เว็บแชท" : "LINE"}</span>

                    {message.status === "sending" && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="flex items-center gap-1">
                          <svg className="animate-spin" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <circle cx="12" cy="12" r="9" opacity="0.25" />
                            <path d="M21 12a9 9 0 0 0-9-9" strokeLinecap="round" />
                          </svg>
                          กำลังส่ง
                        </span>
                      </>
                    )}

                    {message.status === "failed" && (
                      <>
                        <span aria-hidden>·</span>
                        <span className="text-danger">ส่งไม่สำเร็จ</span>
                        {onRetry && (
                          <button
                            type="button"
                            onClick={() => onRetry(message)}
                            className="text-danger underline underline-offset-2"
                          >
                            ลองใหม่
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}

        {peerTyping && (
          <div className="flex items-end gap-2.5">
            {peerBrand ? <BrandMark size={28} /> : <Avatar src={peerAvatar} alt={peerName} size={28} />}
            <TypingDots label={`${peerName} กำลังพิมพ์…`} />
          </div>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
