"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Message, SessionUser } from "@/lib/types";
import Composer from "./Composer";
import MessageList from "./MessageList";

const POLL_MS = 2000;

export default function ChatWindow({ user }: { user: SessionUser }) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const cursor = useRef(0);

  /**
   * ดึงเฉพาะข้อความที่เพิ่มมาหลัง cursor เดิม จึงต่อท้ายได้เลยไม่ซ้ำ
   * (cursor = จำนวนข้อความที่ฝั่งเรามีอยู่แล้ว)
   */
  const poll = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/messages?cursor=${cursor.current}`, { cache: "no-store" });
      if (!res.ok) return;

      const data = (await res.json()) as { messages: Message[]; cursor: number };
      cursor.current = data.cursor;
      if (data.messages.length > 0) {
        setMessages((previous) => [...previous, ...data.messages]);
      }
    } catch {
      // เน็ตสะดุดชั่วคราว — รอบถัดไปค่อยลองใหม่
    }
  }, []);

  useEffect(() => {
    const tick = () => void poll();
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [poll]);

  async function send(text: string) {
    setNotice(null);
    const res = await fetch("/api/chat/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setNotice(data?.error ?? "ส่งข้อความไม่สำเร็จ");
      return;
    }

    const data = (await res.json()) as { warnings?: string[] };
    if (data.warnings?.length) setNotice(data.warnings.join(" · "));

    // ดึงทันทีเพื่อให้ข้อความขึ้นจอโดยไม่ต้องรอรอบ polling
    await poll();
  }

  return (
    <div className="flex h-[calc(100vh-2rem)] max-h-[720px] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-neutral-50 shadow-xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
      <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-800">
        {/* ใช้ <img> ตรง ๆ เพื่อไม่ต้องตั้ง remotePatterns ของ next/image และไม่กินโควตา image optimization */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={user.pictureUrl || "/avatar-placeholder.svg"}
          alt=""
          className="h-9 w-9 rounded-full object-cover"
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium">{user.displayName}</p>
          <p className="text-xs text-neutral-500">คุยกับทีมงานผ่าน LINE OA</p>
        </div>
        <form action="/api/auth/logout" method="post">
          <button type="submit" className="text-xs text-neutral-500 underline hover:text-neutral-700">
            ออกจากระบบ
          </button>
        </form>
      </header>

      <MessageList
        messages={messages}
        viewer="user"
        emptyHint={"ยังไม่มีข้อความ\nพิมพ์ทักทีมงานได้เลย ข้อความจะเข้าไปที่ LINE OA"}
      />

      {notice && (
        <p className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">{notice}</p>
      )}

      <Composer onSend={send} placeholder="พิมพ์ข้อความส่งถึงทีมงาน…" />
    </div>
  );
}
