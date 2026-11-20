export type MessageSender = "user" | "admin";

/** ช่องทางที่ข้อความวิ่งผ่าน — ใช้โชว์ badge ในหน้า inbox */
export type MessageVia = "line" | "web";

export type Message = {
  id: string;
  from: MessageSender;
  via: MessageVia;
  text: string;
  ts: number;
};

export type Conversation = {
  /** = LINE userId (ใช้เป็น conversationId ตรง ๆ) */
  id: string;
  displayName: string;
  pictureUrl: string;
  lastMessage: string;
  lastMessageAt: number;
  unread: number;
  /** ผู้ใช้ยังเป็นเพื่อนกับ OA อยู่ไหม ถ้าบล็อก/ลบเพื่อนแล้ว push จะ error */
  followed: boolean;
};

export type SessionUser = {
  userId: string;
  displayName: string;
  pictureUrl: string;
};
