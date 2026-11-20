# Robolingo Webchat × LINE Official Account

เว็บแชทที่คุยกับ LINE Official Account ได้สองทาง — ผู้ใช้พิมพ์จากหน้าเว็บหรือจากแอป LINE ก็ได้
และทีมงานมีหน้า inbox สำหรับดูว่าใครทักเข้ามาแล้วเลือกตอบเป็นคน ๆ

**Next.js 16 (App Router) · TypeScript · Tailwind CSS v4 · Upstash Redis · LINE Messaging API + LINE Login · Vercel**

หน้าจอเป็นดาร์กโหมดเต็มจอ (100dvh) สลับโหมดสว่างได้และจำค่าไว้ ใช้งานได้ทั้งเดสก์ท็อปและมือถือ
(sidebar พับได้บนเดสก์ท็อป ส่วนมือถือเป็น drawer เลื่อนทับ)

## แนวคิดหลัก: 1 คน = 1 บทสนทนา

Messaging API channel และ LINE Login channel ถูกสร้างไว้ใน **Provider เดียวกัน** ทำให้ `userId`
ที่ได้จาก LINE Login **ตรงกับ** `userId` ที่ได้จาก webhook event

ผลคือไม่ต้องมีระบบจับคู่ identity เลย — คนเดียวกันพิมพ์จากเว็บหรือจาก LINE ก็ลงเธรดเดียวกัน
และหน้า inbox ได้ชื่อจริงกับรูปโปรไฟล์จริงจาก LINE มาแสดง

```
ผู้ใช้พิมพ์ในแอป LINE  ──► POST /api/line/webhook ──► Redis ──► โผล่ที่ /admin และที่ widget ของเขา
ทีมงานตอบที่ /admin    ──► LINE Push API          ──► เข้าแชท LINE ของผู้ใช้ + โผล่ที่ widget
ผู้ใช้พิมพ์ใน widget   ──► POST /api/chat/send    ──► Redis + echo push เข้าแชท LINE ของตัวเอง
                                                       (+ แจ้งเตือนแอดมินถ้าตั้ง ADMIN_LINE_USER_ID)
```

การ push หาผู้ใช้ไม่ทำให้เกิด webhook ย้อนกลับ จึงไม่มี loop

## โครงสร้าง

```
app/
  page.tsx                          widget ผู้ใช้ (ยังไม่ login → ปุ่ม "เข้าสู่ระบบด้วย LINE")
  admin/page.tsx                    inbox ทีมงาน (ไม่มี cookie → redirect ไป /admin/login)
  admin/login/page.tsx              ฟอร์มรหัสผ่าน
  api/line/webhook/route.ts         รับ event จาก LINE + ตรวจลายเซ็น
  api/auth/line/{login,callback}/   LINE Login (authorization code flow + state กัน CSRF)
  api/chat/{send,messages}/         ฝั่งผู้ใช้
  api/admin/{conversations,messages,send,login}/
  api/typing/route.ts               ปักหมุด "กำลังพิมพ์"
components/
  ChatWindow.tsx      หน้าผู้ใช้ — จัดการ polling, ส่งข้อความ, สถานะกำลังส่ง
  AdminInbox.tsx      หน้าทีมงาน — sidebar + เธรด + ช่องตอบ
  Sidebar.tsx         ค้นหา + รายชื่อ User + โปรไฟล์ทีมงาน
  ChatHeader.tsx      แถบหัวแบบ sticky พร้อมสถานะและปุ่มสลับธีม
  MessageList.tsx     เส้นคั่นวัน, avatar, เวลา, สถานะส่ง, typing indicator
  Composer.tsx        ช่องพิมพ์ที่ขยายความสูงเอง + ปุ่มแนบไฟล์ + ปุ่มส่ง
  chatTypes.ts        รวมข้อความ/กันซ้ำ/สถานะ pending
  Skeletons.tsx  ThemeToggle.tsx  TypingDots.tsx  Avatar.tsx  BrandMark.tsx
lib/
  line.ts     verifySignature / pushMessage / replyMessage / getProfile
  store.ts    conversation + message บน Redis
  session.ts  JWT ใน httpOnly cookie (ผู้ใช้ / แอดมิน / oauth state)
  redis.ts  env.ts  types.ts
```

### Data model (Redis)

| Key | ชนิด | เก็บอะไร |
|---|---|---|
| `conv:index` | ZSET | `conversationId` เรียงด้วย score = เวลาข้อความล่าสุด |
| `conv:<userId>` | HASH | ชื่อ, รูปโปรไฟล์, ข้อความล่าสุด, จำนวนที่ยังไม่อ่าน, สถานะเป็นเพื่อน |
| `conv:<userId>:messages` | LIST | ข้อความทั้งเธรดเรียงตามเวลา |
| `typing:<userId>:<user\|admin>` | STRING (TTL 6 วิ) | สถานะกำลังพิมพ์ — หมดอายุเอง ไม่ต้องมี event "หยุดพิมพ์" |

`conversationId` คือ LINE `userId` ตรง ๆ ไม่มีตาราง mapping

### Polling แบบ cursor

`cursor` = จำนวนข้อความที่ client มีอยู่แล้ว ฝั่ง server ตอบด้วย `LRANGE key cursor -1`
จึงส่งเฉพาะส่วนที่เพิ่มมาจริง ๆ ต่อท้ายได้เลยไม่ซ้ำ และไม่ต้องกังวลเรื่อง timestamp ชนกัน

---

## ตั้งค่า LINE

1. [LINE Developers Console](https://developers.line.biz/console/) → สร้าง **Provider ใหม่ 1 ตัว**
   (ทั้งสอง channel ต้องอยู่ provider นี้ ไม่งั้น `userId` จะไม่ตรงกัน)
2. สร้าง **Messaging API channel** → ระบบสร้าง LINE OA ให้อัตโนมัติ
   - Basic settings → เก็บ **Channel secret**
   - Messaging API → **Issue** Channel access token (long-lived)
   - เก็บลิงก์เพิ่มเพื่อน `https://lin.ee/xxxxx`
3. [LINE OA Manager](https://manager.line.biz/) → ตั้งค่า → การตอบกลับ
   - Response mode = **Bot** (ปิด Chat) — ถ้าเปิด Chat ไว้ webhook จะไม่ยิง
   - **ปิด** ข้อความต้อนรับ และ **ปิด** ตอบกลับอัตโนมัติ (แอปส่งข้อความต้อนรับเองผ่าน `follow` event)
   - **เปิด** Webhook
4. สร้าง **LINE Login channel** ใน provider เดิม
   - Callback URL: `https://<โดเมน>/api/auth/line/callback`
   - Scopes: `profile`, `openid`
   - ตั้ง Linked LINE Official Account เป็น OA ข้างบน
5. กลับไป Messaging API channel → Webhook URL = `https://<โดเมน>/api/line/webhook` → กด **Verify** ต้องขึ้น Success

ข้อ 4-5 ต้องใช้โดเมนจริง จึง deploy ขึ้น Vercel ก่อนแล้วเอาโดเมนมากรอก

## Environment variables

ดู [`.env.example`](.env.example) — คัดลอกเป็น `.env.local` สำหรับรันเครื่องตัวเอง

| ตัวแปร | บังคับ | ที่มา |
|---|---|---|
| `LINE_CHANNEL_SECRET` | ✅ | Messaging API channel → Basic settings |
| `LINE_CHANNEL_ACCESS_TOKEN` | ✅ | Messaging API channel → Messaging API |
| `LINE_LOGIN_CHANNEL_ID` | ✅ | LINE Login channel |
| `LINE_LOGIN_CHANNEL_SECRET` | ✅ | LINE Login channel |
| `SESSION_SECRET` | ✅ | สุ่มเอง — `openssl rand -hex 32` |
| `ADMIN_PASSWORD` | ✅ | ตั้งเอง ใช้เข้าหน้า `/admin` |
| `KV_REST_API_URL` / `KV_REST_API_TOKEN` | ✅ | Upstash integration บน Vercel ใส่ให้เอง |
| `UPSTASH_REDIS_REST_URL` / `UPSTASH_REDIS_REST_TOKEN` | — | ใช้แทนคู่บนได้ ถ้าสมัคร Upstash เอง |
| `ADMIN_LINE_USER_ID` | — | แจ้งเตือนแอดมินใน LINE เมื่อมีคนทักจากเว็บ |
| `NEXT_PUBLIC_OA_NAME` | — | ชื่อที่โชว์บนหัวแชทฝั่งผู้ใช้ (ค่าเริ่มต้น "ทีมงาน Robolingo") |
| `NEXT_PUBLIC_BASE_URL` | — | ตั้งเมื่อเดา origin จาก header ไม่ได้ |

## รันบนเครื่อง

```bash
cp .env.example .env.local   # แล้วกรอกค่าให้ครบ
npm install
npm run dev                  # http://localhost:3000
```

LINE ต้องยิง webhook เข้า HTTPS ที่เข้าถึงได้จากอินเทอร์เน็ต ตอน dev จึงต้องเปิด tunnel:

```bash
cloudflared tunnel --url http://localhost:3000
# เอา URL ที่ได้ไปใส่เป็น Webhook URL + Callback URL ชั่วคราว
```

หรือจะทดสอบบน Vercel preview deployment ตรง ๆ ก็ได้ ง่ายกว่า

## Deploy

1. push repo ขึ้น GitHub แบบ public
2. Vercel → Import project → Framework ตรวจเจอ Next.js อัตโนมัติ
3. Storage → Upstash Redis → Connect (env ถูกใส่ให้เอง)
4. ใส่ env ที่เหลือใน Project Settings → Environment Variables
5. Deploy แล้วเอาโดเมนไปใส่ใน LINE console (webhook + callback)

---

## เช็กลิสต์ทดสอบ

| # | ทดสอบ | ผลที่ต้องได้ | ข้อในโจทย์ |
|---|---|---|---|
| 1 | เพิ่ม OA เป็นเพื่อนจากลิงก์ `lin.ee` | ได้ข้อความต้อนรับ | `follow` + reply token |
| 2 | พิมพ์ในแอป LINE แล้วเปิด `/admin` | เห็นชื่อจริง + รูปโปรไฟล์ + ข้อความ ภายใน ~2 วิ | รับข้อความ + เห็นว่า User คือใคร |
| 3 | ที่ `/admin` เลือก User แล้วพิมพ์ตอบ | ข้อความเด้งเข้าแชท LINE | เลือก User เพื่อตอบกลับ |
| 4 | เปิด `/` แล้ว login ด้วย LINE บัญชีเดิม | เห็นประวัติแชทเดิมทั้งหมด | userId ตรงกันข้าม channel |
| 5 | พิมพ์ใน widget | โผล่ที่ `/admin` + echo เข้าแชท LINE | ส่งข้อความจาก webchat ไป LINE OA |
| 6 | ทักจาก LINE บัญชีที่สอง | `/admin` มี 2 บทสนทนาแยกกัน สลับไปมาได้ | แยก User ถูกต้อง |
| 7 | เปิด `/admin` ใน incognito | เจอหน้า login ไม่ใช่ inbox | กันคนนอก |
| 8 | `curl -X POST .../api/line/webhook -d '{}'` | ได้ `401` | ตรวจลายเซ็น |

## ข้อจำกัดที่รู้ตัว

- **ข้อความที่ทีมงานพิมพ์จากหน้า Chat ใน LINE OA Manager จะไม่ยิง webhook** จึงไม่เข้าระบบนี้
  ต้องตอบจาก `/admin` เท่านั้น — เป็นข้อจำกัดของ Messaging API (OA ไม่ส่ง event ข้อความขาออกของตัวเอง)
  และ Response mode ต้องตั้งเป็น Bot อยู่แล้ว
- **Push message กินโควตา** ของ OA free plan ส่วน reply (ข้อความต้อนรับ) ไม่กิน
- **Polling 2 วินาที** ไม่ใช่ realtime จริง — เลือกเพราะ serverless function ของ Vercel
  ถือ WebSocket/SSE ยาว ๆ ไม่ได้ ถ้าจะอัปเกรดคือเปลี่ยนไปใช้ Pusher/Ably แล้วยิง event จาก webhook
- **ส่งได้แต่ข้อความ text** รูป/สติกเกอร์/ไฟล์ที่ส่งเข้ามาจะเก็บเป็น placeholder เช่น `[สติกเกอร์]`
- **ปุ่มแนบไฟล์ยังกดไม่ได้ (disabled)** การส่งรูปเข้า LINE ต้องมี URL สาธารณะแบบ HTTPS ให้ LINE มาดึง
  จึงต้องต่อที่เก็บไฟล์ (เช่น Vercel Blob) ก่อน — ยังไม่อยู่ในขอบเขตของแบบทดสอบนี้
- **typing indicator ใช้สถานะจริง** ไม่ใช่แอนิเมชันหลอก — ฝั่งที่พิมพ์เขียน key ที่มี TTL 6 วินาที
  อีกฝั่งเห็นผ่าน polling รอบถัดไป ความแม่นยำจึงอยู่ในระดับ ~2 วินาทีตามรอบ poll
- **Redis free tier** ไม่ใช่ที่เก็บถาวรระดับ production และไม่มีการลบข้อความเก่าอัตโนมัติ
- หน้า `/admin` ใช้รหัสผ่านเดียวร่วมกัน ไม่มีระบบ user ของแอดมิน
- `cacheComponents` ที่ create-next-app เปิดมาให้ถูกปิดไว้ เพราะทุกหน้าของแอปนี้เป็น dynamic
  อยู่แล้ว (อ่าน cookie + polling) เปิดไว้มีแต่ต้องใส่ `Suspense`/`'use cache'` เพิ่มโดยไม่ได้ประโยชน์
