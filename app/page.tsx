import ChatWindow from "@/components/ChatWindow";
import { getUserSession } from "@/lib/session";

export const dynamic = "force-dynamic";

export default async function HomePage({ searchParams }: PageProps<"/">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const user = await getUserSession();

  return (
    <main className="flex flex-1 items-center justify-center bg-neutral-100 p-4 dark:bg-neutral-950">
      {user ? (
        <ChatWindow user={user} />
      ) : (
        <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-xl ring-1 ring-neutral-200 dark:bg-neutral-900 dark:ring-neutral-700">
          <h1 className="text-xl font-semibold">เว็บแชท × LINE OA</h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-600 dark:text-neutral-400">
            เข้าสู่ระบบด้วย LINE เพื่อเริ่มคุย ข้อความที่พิมพ์ที่นี่จะเข้าไปที่ LINE Official Account
            และข้อความที่ทีมงานตอบจะเด้งกลับมาทั้งในหน้านี้และในแอป LINE ของคุณ
          </p>

          {error && (
            <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-xs text-red-700">{error}</p>
          )}

          <a
            href="/api/auth/line/login"
            className="mt-6 inline-flex w-full items-center justify-center rounded-xl bg-[#06C755] px-4 py-3 text-sm font-medium text-white transition hover:brightness-95"
          >
            เข้าสู่ระบบด้วย LINE
          </a>

          <p className="mt-4 text-xs text-neutral-400">
            หน้าสำหรับทีมงาน: <a href="/admin" className="underline">/admin</a>
          </p>
        </div>
      )}
    </main>
  );
}
