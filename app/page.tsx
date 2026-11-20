import ChatWindow from "@/components/ChatWindow";
import ThemeToggle from "@/components/ThemeToggle";
import { getUserSession } from "@/lib/session";

export const dynamic = "force-dynamic";

const OA_NAME = process.env.NEXT_PUBLIC_OA_NAME || "ทีมงาน Robolingo";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const user = await getUserSession();

  if (user) return <ChatWindow user={user} oaName={OA_NAME} />;

  return (
    <main className="flex h-[100dvh] flex-col bg-bg text-fg">
      <div className="flex justify-end p-4">
        <ThemeToggle />
      </div>

      <div className="flex flex-1 items-center justify-center px-5 pb-24">
        <div className="w-full max-w-sm">
          <div className="mb-7 flex flex-col items-center gap-3 text-center">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-accent text-accent-fg">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-3.9-.9L3 21l1.9-4.1A8.4 8.4 0 0 1 4 11.5 8.5 8.5 0 0 1 12.5 3 8.5 8.5 0 0 1 21 11.5z" />
              </svg>
            </div>
            <h1 className="text-xl font-semibold tracking-tight">เว็บแชท × LINE OA</h1>
            <p className="text-[13px] leading-relaxed text-muted">
              เข้าสู่ระบบด้วย LINE เพื่อเริ่มคุย ข้อความที่พิมพ์ที่นี่จะเข้าไปที่ LINE Official Account
              และคำตอบจากทีมงานจะเด้งกลับมาทั้งหน้านี้และในแอป LINE ของคุณ
            </p>
          </div>

          {error && (
            <p className="mb-4 rounded-lg border border-line bg-warning-bg px-3 py-2 text-center text-xs text-warning-fg">
              {error}
            </p>
          )}

          <a
            href="/api/auth/line/login"
            className="flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-accent text-sm font-medium text-accent-fg transition hover:bg-accent-hover"
          >
            เข้าสู่ระบบด้วย LINE
          </a>

          <p className="mt-5 text-center text-[11.5px] text-faint">
            สำหรับทีมงาน:{" "}
            <a href="/admin" className="underline underline-offset-2 transition hover:text-muted">
              เปิดกล่องข้อความ
            </a>
          </p>
        </div>
      </div>
    </main>
  );
}
