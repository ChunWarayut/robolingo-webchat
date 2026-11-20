"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Conversation, Message } from "@/lib/types";
import Composer from "./Composer";
import MessageList from "./MessageList";
import { mergeMessages } from "./mergeMessages";

const POLL_MS = 2000;

function formatRelative(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "เมื่อครู่";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} นาที`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชม.`;
  return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

export default function AdminInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);

  const cursor = useRef(0);
  // เก็บ id ที่เลือกไว้ใน ref ด้วย เพื่อให้ interval เดิมอ่านค่าล่าสุดได้
  const selectedRef = useRef<string | null>(null);
  // กันไม่ให้ request ซ้อนกัน: ถ้ารอบก่อนยังไม่ตอบ ทั้งคู่จะอ่าน cursor ค่าเดิมแล้วต่อท้ายข้อความซ้ำ
  const loadingMessages = useRef(false);
  const loadingConversations = useRef(false);

  const pollConversations = useCallback(async () => {
    if (loadingConversations.current) return;
    loadingConversations.current = true;
    try {
      const res = await fetch("/api/admin/conversations", { cache: "no-store" });
      if (!res.ok) {
        // ไม่เงียบ: ถ้าต่อ Redis ไม่ได้หรือ session หมดอายุ ต้องเห็นบนหน้าจอ ไม่ใช่เห็นแค่ใน log
        setConnectionError(
          res.status === 401
            ? "เซสชันหมดอายุ — กรุณาเข้าสู่ระบบใหม่"
            : `โหลดรายการบทสนทนาไม่สำเร็จ (HTTP ${res.status})`,
        );
        return;
      }
      const data = (await res.json()) as { conversations: Conversation[] };
      setConversations(data.conversations);
      setConnectionError(null);
    } catch {
      setConnectionError("เชื่อมต่อเซิร์ฟเวอร์ไม่ได้ — กำลังลองใหม่");
    } finally {
      loadingConversations.current = false;
    }
  }, []);

  const pollMessages = useCallback(async () => {
    const id = selectedRef.current;
    if (!id || loadingMessages.current) return;
    loadingMessages.current = true;

    try {
      const res = await fetch(`/api/admin/messages?id=${encodeURIComponent(id)}&cursor=${cursor.current}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = (await res.json()) as { messages: Message[]; cursor: number };
      // กัน race: ถ้าสลับบทสนทนาไปแล้วระหว่างรอ response ให้ทิ้งผลลัพธ์นี้
      if (selectedRef.current !== id) return;

      cursor.current = data.cursor;
      if (data.messages.length > 0) {
        setMessages((previous) => mergeMessages(previous, data.messages));
      }
    } catch {
      // ข้ามรอบนี้ไป
    } finally {
      loadingMessages.current = false;
    }
  }, []);

  useEffect(() => {
    const tick = () => {
      void pollConversations();
      void pollMessages();
    };
    // ยิงรอบแรกผ่าน timer เหมือนกัน เพื่อไม่ให้ effect body เรียก setState ตรง ๆ
    const first = setTimeout(tick, 0);
    const timer = setInterval(tick, POLL_MS);
    return () => {
      clearTimeout(first);
      clearInterval(timer);
    };
  }, [pollConversations, pollMessages]);

  function select(id: string) {
    selectedRef.current = id;
    cursor.current = 0;
    setSelectedId(id);
    setMessages([]);
    setError(null);
    void pollMessages();
  }

  async function reply(text: string) {
    const id = selectedRef.current;
    if (!id) return;
    setError(null);

    const res = await fetch("/api/admin/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, text }),
    });

    if (!res.ok) {
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      setError(data?.error ?? "ส่งข้อความไม่สำเร็จ");
      return;
    }

    await pollMessages();
    await pollConversations();
  }

  const selected = conversations.find((c) => c.id === selectedId) ?? null;

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-950">
      {/* ซ้าย: รายชื่อ User ที่คุยเข้ามา */}
      <aside className="flex w-80 shrink-0 flex-col border-r border-neutral-200 bg-white dark:border-neutral-800 dark:bg-neutral-900">
        <header className="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <div>
            <h1 className="text-sm font-semibold">กล่องข้อความ</h1>
            <p className="text-xs text-neutral-500">{conversations.length} บทสนทนา</p>
          </div>
          <form action="/api/auth/logout?scope=admin" method="post">
            <button type="submit" className="text-xs text-neutral-500 underline hover:text-neutral-700">
              ออกจากระบบ
            </button>
          </form>
        </header>

        {connectionError && (
          <p className="border-b border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-800">
            {connectionError}
          </p>
        )}

        <div className="flex-1 overflow-y-auto">
          {conversations.length === 0 && !connectionError && (
            <p className="p-4 text-xs text-neutral-500">
              ยังไม่มีใครคุยเข้ามา — ลองเพิ่ม LINE OA เป็นเพื่อนแล้วพิมพ์ทักดู
            </p>
          )}

          {conversations.map((conversation) => (
            <button
              key={conversation.id}
              type="button"
              onClick={() => select(conversation.id)}
              className={`flex w-full items-center gap-3 border-b border-neutral-100 px-4 py-3 text-left transition hover:bg-neutral-50 dark:border-neutral-800 dark:hover:bg-neutral-800 ${
                conversation.id === selectedId ? "bg-neutral-100 dark:bg-neutral-800" : ""
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={conversation.pictureUrl || "/avatar-placeholder.svg"}
                alt=""
                className="h-10 w-10 shrink-0 rounded-full object-cover"
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-2">
                  <p className="truncate text-sm font-medium">{conversation.displayName}</p>
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {formatRelative(conversation.lastMessageAt)}
                  </span>
                </div>
                <p className="truncate text-xs text-neutral-500">{conversation.lastMessage || "—"}</p>
              </div>
              {conversation.unread > 0 && (
                <span className="shrink-0 rounded-full bg-[#06C755] px-2 py-0.5 text-[11px] font-medium text-white">
                  {conversation.unread}
                </span>
              )}
            </button>
          ))}
        </div>
      </aside>

      {/* ขวา: บทสนทนาที่เลือก + ช่องตอบกลับ */}
      <section className="flex min-w-0 flex-1 flex-col">
        {!selected ? (
          <div className="flex flex-1 items-center justify-center text-sm text-neutral-500">
            เลือก User จากรายการด้านซ้ายเพื่อดูและตอบกลับ
          </div>
        ) : (
          <>
            <header className="flex items-center gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-800 dark:bg-neutral-900">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={selected.pictureUrl || "/avatar-placeholder.svg"}
                alt=""
                className="h-9 w-9 rounded-full object-cover"
              />
              <div className="min-w-0">
                <p className="truncate text-sm font-medium">{selected.displayName}</p>
                <p className="truncate font-mono text-[11px] text-neutral-400">{selected.id}</p>
              </div>
              {!selected.followed && (
                <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-[11px] text-amber-800">
                  เลิกติดตาม OA แล้ว
                </span>
              )}
            </header>

            <MessageList
              messages={messages}
              viewer="admin"
              emptyHint="ยังไม่มีข้อความในบทสนทนานี้"
            />

            {error && (
              <p className="border-t border-red-200 bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>
            )}

            <Composer
              onSend={reply}
              disabled={!selected.followed}
              placeholder={
                selected.followed
                  ? `ตอบกลับ ${selected.displayName}…`
                  : "ผู้ใช้เลิกติดตาม OA แล้ว ส่งข้อความไม่ได้"
              }
            />
          </>
        )}
      </section>
    </div>
  );
}
