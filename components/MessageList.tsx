"use client";

import { useEffect, useRef } from "react";
import type { Message } from "@/lib/types";

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

type Props = {
  messages: Message[];
  /** ใครกำลังดู — ใช้ตัดสินว่าฝั่งไหนคือ "ข้อความของเรา" (ชิดขวา) */
  viewer: "user" | "admin";
  emptyHint: string;
};

export default function MessageList({ messages, viewer, emptyHint }: Props) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length]);

  if (messages.length === 0) {
    return (
      <div className="flex flex-1 items-center justify-center p-8 text-center text-sm text-neutral-500">
        {emptyHint}
      </div>
    );
  }

  return (
    <div className="flex-1 space-y-3 overflow-y-auto p-4">
      {messages.map((message) => {
        const mine = message.from === viewer;
        return (
          <div key={message.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
            <div
              className={`max-w-[78%] rounded-2xl px-4 py-2 text-sm whitespace-pre-wrap break-words shadow-sm ${
                mine
                  ? "bg-[#06C755] text-white"
                  : "bg-white text-neutral-900 ring-1 ring-neutral-200 dark:bg-neutral-800 dark:text-neutral-100 dark:ring-neutral-700"
              }`}
            >
              <p>{message.text}</p>
              <p className={`mt-1 text-[11px] ${mine ? "text-white/70" : "text-neutral-400"}`}>
                {formatTime(message.ts)} · {message.via === "web" ? "เว็บแชท" : "LINE"}
              </p>
            </div>
          </div>
        );
      })}
      <div ref={bottomRef} />
    </div>
  );
}
