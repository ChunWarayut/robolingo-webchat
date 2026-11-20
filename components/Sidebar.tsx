"use client";

import { useMemo, useState } from "react";
import type { Conversation } from "@/lib/types";
import Avatar from "./Avatar";
import { ConversationSkeleton } from "./Skeletons";

function formatRelative(ts: number): string {
  if (!ts) return "";
  const diff = Date.now() - ts;
  if (diff < 60_000) return "เมื่อครู่";
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)} น.`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)} ชม.`;
  return new Date(ts).toLocaleDateString("th-TH", { day: "numeric", month: "short" });
}

type Props = {
  conversations: Conversation[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  loading: boolean;
  connectionError: string | null;
};

export default function Sidebar({ conversations, selectedId, onSelect, loading, connectionError }: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return conversations;

    return conversations.filter(
      (conversation) =>
        conversation.displayName.toLowerCase().includes(needle) ||
        conversation.lastMessage.toLowerCase().includes(needle),
    );
  }, [conversations, query]);

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="border-b border-line p-3">
        <div className="flex items-center justify-between px-1 pb-3">
          <h1 className="text-sm font-semibold">กล่องข้อความ</h1>
          <span className="text-[11px] text-faint">{conversations.length} บทสนทนา</span>
        </div>

        <div className="flex items-center gap-2 rounded-lg border border-line bg-bg px-2.5 py-2 focus-within:border-accent">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" className="shrink-0 text-faint">
            <circle cx="11" cy="11" r="7" />
            <path d="m20 20-3.2-3.2" />
          </svg>
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="ค้นหาชื่อหรือข้อความ"
            className="w-full bg-transparent text-[13px] outline-none placeholder:text-faint"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="ล้างคำค้น"
              className="shrink-0 text-faint transition hover:text-fg"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="m6 6 12 12M18 6 6 18" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {connectionError && (
        <p className="border-b border-line bg-warning-bg px-4 py-2 text-[11px] text-warning-fg">{connectionError}</p>
      )}

      <div className="flex-1 overflow-y-auto">
        {loading && conversations.length === 0 && <ConversationSkeleton />}

        {!loading && conversations.length === 0 && !connectionError && (
          <p className="p-4 text-xs leading-relaxed text-muted">
            ยังไม่มีใครคุยเข้ามา — ลองเพิ่ม LINE OA เป็นเพื่อนแล้วพิมพ์ทักดู
          </p>
        )}

        {conversations.length > 0 && filtered.length === 0 && (
          <p className="p-4 text-xs text-muted">ไม่พบบทสนทนาที่ตรงกับ “{query}”</p>
        )}

        <div className="space-y-0.5 p-2">
          {filtered.map((conversation) => {
            const active = conversation.id === selectedId;

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => onSelect(conversation.id)}
                className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                  active ? "bg-elevated ring-1 ring-line" : "hover:bg-elevated/70"
                }`}
              >
                <Avatar src={conversation.pictureUrl} alt="" size={36} />

                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-2">
                    <p className={`truncate text-[13px] ${active ? "font-medium" : ""}`}>
                      {conversation.displayName}
                    </p>
                    <span className="shrink-0 text-[10.5px] text-faint">
                      {formatRelative(conversation.lastMessageAt)}
                    </span>
                  </div>
                  <p className="truncate text-[11.5px] text-muted">{conversation.lastMessage || "—"}</p>
                </div>

                {conversation.unread > 0 && (
                  <span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-accent px-1.5 text-[10.5px] font-medium text-accent-fg">
                    {conversation.unread}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-3 border-t border-line p-3">
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent text-[12px] font-medium text-accent-fg">
          ทีม
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-[13px] font-medium">ทีมงาน</p>
          <p className="truncate text-[11px] text-muted">ตอบผ่าน LINE OA</p>
        </div>
        <form action="/api/auth/logout?scope=admin" method="post">
          <button
            type="submit"
            aria-label="ออกจากระบบ"
            title="ออกจากระบบ"
            className="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-elevated hover:text-fg"
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
