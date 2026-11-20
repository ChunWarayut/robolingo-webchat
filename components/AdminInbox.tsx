"use client";

import { useCallback, useRef, useState } from "react";
import type { Conversation, Message } from "@/lib/types";
import ChatHeader from "./ChatHeader";
import Composer from "./Composer";
import MessageList from "./MessageList";
import Sidebar from "./Sidebar";
import { usePolling } from "./usePolling";
import {
  createPendingMessage,
  markFailed,
  mergeMessages,
  settlePending,
  type ChatMessage,
} from "./chatTypes";

const ACTIVE_POLL_MS = 1000;
const HIDDEN_POLL_MS = 15000;

function lastActiveText(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 120_000) return "ใช้งานเมื่อครู่";
  if (diff < 3_600_000) return `ใช้งานล่าสุด ${Math.floor(diff / 60_000)} นาทีที่แล้ว`;
  if (diff < 86_400_000) return `ใช้งานล่าสุด ${Math.floor(diff / 3_600_000)} ชม.ที่แล้ว`;
  return `ใช้งานล่าสุด ${new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short" })}`;
}

export default function AdminInbox() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(true);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const cursor = useRef(0);
  // เก็บ id ที่เลือกไว้ใน ref ด้วย เพื่อให้ interval เดิมอ่านค่าล่าสุดได้
  const selectedRef = useRef<string | null>(null);
  // กันไม่ให้ request ซ้อนกัน: ถ้ารอบก่อนยังไม่ตอบ ทั้งคู่จะอ่าน cursor ค่าเดิมแล้วต่อท้ายข้อความซ้ำ
  const loadingMessagesRef = useRef(false);
  const loadingConversationsRef = useRef(false);

  const pollConversations = useCallback(async () => {
    if (loadingConversationsRef.current) return;
    loadingConversationsRef.current = true;

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
      loadingConversationsRef.current = false;
      setLoadingConversations(false);
    }
  }, []);

  const pollMessages = useCallback(async () => {
    const id = selectedRef.current;
    if (!id || loadingMessagesRef.current) return;
    loadingMessagesRef.current = true;

    try {
      const res = await fetch(`/api/admin/messages?id=${encodeURIComponent(id)}&cursor=${cursor.current}`, {
        cache: "no-store",
      });
      if (!res.ok) return;

      const data = (await res.json()) as {
        messages: Message[];
        cursor: number;
        peerTyping?: boolean;
      };
      // กัน race: ถ้าสลับบทสนทนาไปแล้วระหว่างรอ response ให้ทิ้งผลลัพธ์นี้
      if (selectedRef.current !== id) return;

      cursor.current = data.cursor;
      setPeerTyping(Boolean(data.peerTyping));
      if (data.messages.length > 0) {
        setMessages((previous) => mergeMessages(previous, data.messages));
      }
    } catch {
      // ข้ามรอบนี้ไป
    } finally {
      loadingMessagesRef.current = false;
      // ปิด skeleton เฉพาะเมื่อ response นี้เป็นของห้องที่กำลังดูอยู่จริง
      // ไม่งั้น response ของห้องเก่าจะไปปิด skeleton ของห้องที่เพิ่งกดเลือก
      // แล้วโชว์ "ยังไม่มีข้อความ" ทั้งที่ยังไม่ได้ดึงอะไรมาเลย
      if (selectedRef.current === id) setLoadingMessages(false);
    }
  }, []);

  usePolling(
    useCallback(() => {
      void pollConversations();
      void pollMessages();
    }, [pollConversations, pollMessages]),
    ACTIVE_POLL_MS,
    HIDDEN_POLL_MS,
  );

  function select(id: string) {
    selectedRef.current = id;
    cursor.current = 0;
    setSelectedId(id);
    setMessages([]);
    setPeerTyping(false);
    setSendError(null);
    setLoadingMessages(true);
    setDrawerOpen(false);
    void pollMessages();
  }

  async function deliver(pending: ChatMessage) {
    const id = selectedRef.current;
    if (!id) return;

    // ถ้าสลับไปห้องอื่นแล้วระหว่างรอ response ห้ามแตะ state ต่อ
    // เพราะ messages ตอนนี้เป็นของอีกห้องหนึ่ง ข้อความที่ส่งถึง A จะไปโผล่ในห้อง B
    const stillOnSameConversation = () => selectedRef.current === id;

    try {
      const res = await fetch("/api/admin/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, text: pending.text }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!stillOnSameConversation()) return;

        setSendError(data?.error ?? "ส่งข้อความไม่สำเร็จ");
        setMessages((previous) => markFailed(previous, pending.id));
        return;
      }

      const data = (await res.json()) as { message: Message };
      // ส่งสำเร็จแล้ว รายการห้องต้องอัปเดตไม่ว่าจะยังดูห้องเดิมอยู่หรือไม่
      void pollConversations();
      if (!stillOnSameConversation()) return;

      setMessages((previous) => settlePending(previous, pending.id, data.message));
    } catch {
      if (!stillOnSameConversation()) return;

      setSendError("เชื่อมต่อไม่ได้ — ข้อความยังไม่ถูกส่ง");
      setMessages((previous) => markFailed(previous, pending.id));
    }
  }

  async function send(text: string) {
    setSendError(null);
    const pending = createPendingMessage("admin", "line", text);
    setMessages((previous) => [...previous, pending]);
    await deliver(pending);
  }

  function retry(message: ChatMessage) {
    setSendError(null);
    setMessages((previous) =>
      previous.map((item) => (item.id === message.id ? { ...item, status: "sending" as const } : item)),
    );
    void deliver(message);
  }

  function pingTyping() {
    const id = selectedRef.current;
    if (!id) return;

    void fetch("/api/typing", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    }).catch(() => undefined);
  }

  const selected = conversations.find((conversation) => conversation.id === selectedId) ?? null;

  const sidebar = (
    <Sidebar
      conversations={conversations}
      selectedId={selectedId}
      onSelect={select}
      loading={loadingConversations}
      connectionError={connectionError}
    />
  );

  return (
    <div className="flex h-[100dvh] overflow-hidden bg-bg text-fg">
      {/* เดสก์ท็อป: พับเก็บได้ */}
      <aside
        className={`hidden shrink-0 overflow-hidden border-line transition-[width] duration-200 md:block ${
          sidebarCollapsed ? "w-0 border-r-0" : "w-72 border-r"
        }`}
      >
        <div className="h-full w-72">{sidebar}</div>
      </aside>

      {/* มือถือ: drawer เลื่อนทับ */}
      <div className={`fixed inset-0 z-40 md:hidden ${drawerOpen ? "" : "pointer-events-none"}`}>
        <button
          type="button"
          aria-label="ปิดรายการบทสนทนา"
          onClick={() => setDrawerOpen(false)}
          className={`absolute inset-0 bg-black/60 transition-opacity duration-200 ${
            drawerOpen ? "opacity-100" : "opacity-0"
          }`}
        />
        <div
          className={`absolute inset-y-0 left-0 w-[86%] max-w-xs border-r border-line shadow-2xl transition-transform duration-200 ${
            drawerOpen ? "translate-x-0" : "-translate-x-full"
          }`}
        >
          {sidebar}
        </div>
      </div>

      <main className="flex min-w-0 flex-1 flex-col">
        {selected ? (
          <>
            <ChatHeader
              title={selected.displayName}
              avatarUrl={selected.pictureUrl}
              online={selected.followed}
              statusText={selected.followed ? "ออนไลน์" : "เลิกติดตาม OA แล้ว"}
              subtitle={lastActiveText(selected.lastMessageAt)}
              leading={
                <>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(true)}
                    aria-label="เปิดรายการบทสนทนา"
                    className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg md:hidden"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round">
                      <path d="M3 6h18M3 12h18M3 18h18" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSidebarCollapsed((value) => !value)}
                    aria-label={sidebarCollapsed ? "แสดงรายการบทสนทนา" : "พับรายการบทสนทนา"}
                    title={sidebarCollapsed ? "แสดงรายการบทสนทนา" : "พับรายการบทสนทนา"}
                    className="hidden h-9 w-9 shrink-0 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg md:grid"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                      <rect x="3" y="4" width="18" height="16" rx="2" />
                      <path d="M9 4v16" />
                    </svg>
                  </button>
                </>
              }
            />

            <MessageList
              messages={messages}
              viewer="admin"
              peerName={selected.displayName}
              peerAvatar={selected.pictureUrl}
              peerTyping={peerTyping}
              loading={loadingMessages && messages.length === 0}
              emptyTitle="ยังไม่มีข้อความ"
              emptyHint="เริ่มทักได้เลย ข้อความจะถูกส่งเข้าแชท LINE ของผู้ใช้"
              onRetry={retry}
            />

            {sendError && (
              <p className="shrink-0 border-t border-line bg-warning-bg px-4 py-2 text-[11.5px] text-warning-fg">
                {sendError}
              </p>
            )}

            <Composer
              onSend={send}
              onTyping={pingTyping}
              disabled={!selected.followed}
              disabledReason="ผู้ใช้เลิกติดตาม OA แล้ว ส่งข้อความไม่ได้"
              placeholder={`ตอบกลับ ${selected.displayName}…`}
            />
          </>
        ) : (
          <>
            {/* มือถือ: ยังไม่เลือกใคร = โชว์รายการเต็มจอไปเลย ไม่ต้องให้กดเปิด drawer ก่อน */}
            <div className="min-h-0 flex-1 md:hidden">{sidebar}</div>

            <div className="hidden flex-1 flex-col items-center justify-center gap-2 p-8 text-center md:flex">
              <p className="text-sm font-medium">ยังไม่ได้เลือกบทสนทนา</p>
              <p className="max-w-xs text-xs text-muted">
                เลือก User จากรายการด้านซ้ายเพื่อดูประวัติและตอบกลับ
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
