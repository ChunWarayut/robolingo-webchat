"use client";

import { useCallback, useRef, useState } from "react";
import type { Message, SessionUser } from "@/lib/types";
import ChatHeader from "./ChatHeader";
import Composer from "./Composer";
import MessageList from "./MessageList";
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

export default function ChatWindow({ user, oaName }: { user: SessionUser; oaName: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [peerTyping, setPeerTyping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [connected, setConnected] = useState(true);
  const [loading, setLoading] = useState(true);

  const cursor = useRef(0);
  const polling = useRef(false);

  /**
   * ดึงเฉพาะข้อความที่เพิ่มมาหลัง cursor เดิม จึงต่อท้ายได้เลยไม่ซ้ำ
   * (cursor = จำนวนข้อความที่ฝั่งเรามีอยู่แล้ว)
   */
  const poll = useCallback(async () => {
    // กัน request ซ้อน: ถ้ารอบก่อนยังไม่ตอบ ทั้งคู่จะอ่าน cursor ค่าเดิมแล้วต่อท้ายข้อความซ้ำ
    if (polling.current) return;
    polling.current = true;

    try {
      const res = await fetch(`/api/chat/messages?cursor=${cursor.current}`, { cache: "no-store" });
      if (!res.ok) {
        setConnected(false);
        return;
      }

      const data = (await res.json()) as {
        messages: Message[];
        cursor: number;
        peerTyping?: boolean;
      };

      cursor.current = data.cursor;
      setConnected(true);
      setPeerTyping(Boolean(data.peerTyping));
      if (data.messages.length > 0) {
        setMessages((previous) => mergeMessages(previous, data.messages));
      }
    } catch {
      // เน็ตสะดุดชั่วคราว — รอบถัดไปค่อยลองใหม่
      setConnected(false);
    } finally {
      polling.current = false;
      setLoading(false);
    }
  }, []);

  usePolling(
    useCallback(() => void poll(), [poll]),
    ACTIVE_POLL_MS,
    HIDDEN_POLL_MS,
  );

  async function deliver(pending: ChatMessage) {
    try {
      const res = await fetch("/api/chat/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: pending.text }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        setNotice(data?.error ?? "ส่งข้อความไม่สำเร็จ");
        setMessages((previous) => markFailed(previous, pending.id));
        return;
      }

      const data = (await res.json()) as { message: Message; warnings?: string[] };
      setNotice(data.warnings?.length ? data.warnings.join(" · ") : null);
      setMessages((previous) => settlePending(previous, pending.id, data.message));
    } catch {
      setNotice("เชื่อมต่อไม่ได้ — ข้อความยังไม่ถูกส่ง");
      setMessages((previous) => markFailed(previous, pending.id));
    }
  }

  async function send(text: string) {
    setNotice(null);
    const pending = createPendingMessage("user", "web", text);
    setMessages((previous) => [...previous, pending]);
    await deliver(pending);
  }

  function retry(message: ChatMessage) {
    setNotice(null);
    setMessages((previous) =>
      previous.map((item) => (item.id === message.id ? { ...item, status: "sending" as const } : item)),
    );
    void deliver(message);
  }

  function pingTyping() {
    void fetch("/api/typing", { method: "POST" }).catch(() => undefined);
  }

  return (
    <div className="flex h-[100dvh] flex-col bg-bg text-fg">
      <ChatHeader
        title={oaName}
        brand
        online={connected}
        statusText={connected ? "ออนไลน์" : "ขาดการเชื่อมต่อ"}
        subtitle={`คุยในชื่อ ${user.displayName}`}
        trailing={
          <form action="/api/auth/logout" method="post">
            <button
              type="submit"
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
              className="grid h-9 w-9 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
              </svg>
            </button>
          </form>
        }
      />

      <MessageList
        messages={messages}
        viewer="user"
        peerName="ทีมงาน"
        peerBrand
        peerTyping={peerTyping}
        loading={loading && messages.length === 0}
        emptyTitle="เริ่มคุยกับทีมงานได้เลย"
        emptyHint={"ข้อความที่พิมพ์ที่นี่จะเข้าไปที่ LINE OA\nและคำตอบจะเด้งกลับมาทั้งที่นี่และในแอป LINE"}
        onRetry={retry}
      />

      {notice && (
        <p className="shrink-0 border-t border-line bg-warning-bg px-4 py-2 text-center text-[11.5px] text-warning-fg">
          {notice}
        </p>
      )}

      <Composer onSend={send} onTyping={pingTyping} placeholder="พิมพ์ข้อความส่งถึงทีมงาน…" />
    </div>
  );
}
