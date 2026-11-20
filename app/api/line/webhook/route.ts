import { NextResponse } from "next/server";
import { pushMessage, replyMessage, verifySignature } from "@/lib/line";
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

/**
 * ส่งข้อความต้อนรับ: ใช้ replyToken ก่อนเพราะไม่กินโควตา
 * ถ้า token หมดอายุหรือใช้ไปแล้ว ค่อยถอยไปใช้ push ซึ่งกินโควตาแต่ไม่พลาด
 * เก็บลงประวัติด้วย เพื่อให้เห็นข้อความเดียวกันทั้งในแอป LINE และในเว็บแชท
 */
async function sendWelcome(userId: string, replyToken?: string): Promise<void> {
  if (replyToken) {
    try {
      await replyMessage(replyToken, WELCOME);
      await appendMessage(userId, { from: "admin", via: "line", text: WELCOME });
      return;
    } catch (error) {
      console.error("[line/webhook] reply ข้อความต้อนรับไม่สำเร็จ จะลองใหม่ด้วย push:", error);
    }
  }

  await pushMessage(userId, WELCOME);
  await appendMessage(userId, { from: "admin", via: "line", text: WELCOME });
}

async function handleEvent(event: LineEvent): Promise<void> {
  // รองรับแชท 1:1 เท่านั้น — group/room ไม่อยู่ในขอบเขตของแบบทดสอบ
  if (event.source?.type !== "user" || !event.source.userId) return;
  const userId = event.source.userId;

  switch (event.type) {
    case "follow": {
      await ensureConversation(userId, undefined, true);
      await sendWelcome(userId, event.replyToken);
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

  // บันทึกไว้เสมอว่าได้ event อะไรมาบ้าง เวลาอะไรไม่มาจะได้แยกออกว่า
  // "LINE ไม่ส่งมา" หรือ "ส่งมาแล้วแต่เราจัดการพลาด" โดยไม่ต้องเดา
  console.info(
    `[line/webhook] ได้รับ ${events.length} event: ${events.map((e) => e.type).join(", ") || "(ว่าง — น่าจะเป็นปุ่ม Verify)"}`,
  );

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
