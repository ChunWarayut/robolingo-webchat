import { NextResponse } from "next/server";
import { replyMessage, verifySignature } from "@/lib/line";
import { appendMessage, ensureConversation, setFollowed } from "@/lib/store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type LineSource = { type: string; userId?: string };

type LineEvent = {
  type: string;
  replyToken?: string;
  source?: LineSource;
  message?: { type: string; text?: string };
};

const WELCOME =
  "สวัสดีครับ 👋 ขอบคุณที่เพิ่มเพื่อน\n" +
  "พิมพ์คุยที่นี่ได้เลย ทีมงานจะเห็นข้อความและตอบกลับให้\n" +
  "หรือจะคุยผ่านหน้าเว็บแชทก็ได้ ประวัติเป็นอันเดียวกัน";

/** แปลงข้อความที่ไม่ใช่ text ให้เป็น placeholder อ่านรู้เรื่องในหน้า inbox */
function describeNonText(messageType: string): string {
  const labels: Record<string, string> = {
    image: "[รูปภาพ]",
    video: "[วิดีโอ]",
    audio: "[เสียง]",
    file: "[ไฟล์]",
    location: "[ตำแหน่งที่ตั้ง]",
    sticker: "[สติกเกอร์]",
  };
  return labels[messageType] ?? `[${messageType}]`;
}

async function handleEvent(event: LineEvent): Promise<void> {
  // รองรับแชท 1:1 เท่านั้น — group/room ไม่อยู่ในขอบเขตของแบบทดสอบ
  if (event.source?.type !== "user" || !event.source.userId) return;
  const userId = event.source.userId;

  switch (event.type) {
    case "follow": {
      await ensureConversation(userId);
      if (event.replyToken) {
        // ใช้ replyToken เพราะไม่กินโควตาข้อความของ OA
        await replyMessage(event.replyToken, WELCOME);
      }
      return;
    }

    case "unfollow": {
      await setFollowed(userId, false);
      return;
    }

    case "message": {
      if (!event.message) return;
      await ensureConversation(userId);
      const text =
        event.message.type === "text" && event.message.text
          ? event.message.text
          : describeNonText(event.message.type);
      await appendMessage(userId, { from: "user", via: "line", text });
      return;
    }

    default:
      return;
  }
}

export async function POST(req: Request) {
  // ต้องอ่าน raw body ก่อน parse ไม่งั้นลายเซ็นจะไม่ตรง
  const raw = await req.text();

  if (!verifySignature(raw, req.headers.get("x-line-signature"))) {
    return NextResponse.json({ error: "ลายเซ็นไม่ถูกต้อง" }, { status: 401 });
  }

  let events: LineEvent[] = [];
  try {
    events = (JSON.parse(raw) as { events?: LineEvent[] }).events ?? [];
  } catch {
    return NextResponse.json({ error: "body ไม่ใช่ JSON" }, { status: 400 });
  }

  // ปุ่ม Verify ใน LINE console ส่ง events ว่างมา — ต้องตอบ 200
  const results = await Promise.allSettled(events.map(handleEvent));
  for (const result of results) {
    if (result.status === "rejected") {
      console.error("[line/webhook] จัดการ event ไม่สำเร็จ:", result.reason);
    }
  }

  // ตอบ 200 เสมอแม้มี event พัง ไม่งั้น LINE จะ retry ซ้ำ ๆ และปิด webhook ให้เอง
  return NextResponse.json({ ok: true });
}

/** เปิดใน browser เพื่อเช็คว่า route มีจริง */
export async function GET() {
  return NextResponse.json({ ok: true, hint: "LINE webhook endpoint — ใช้ POST เท่านั้น" });
}
