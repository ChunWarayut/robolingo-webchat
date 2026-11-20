/**
 * อ่าน env var แบบบังคับว่าต้องมี — เรียกตอน runtime เท่านั้น (ไม่เรียกตอน import)
 * เพื่อให้ `next build` ผ่านแม้ยังไม่ได้ตั้งค่าครบ
 */
export function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`ไม่ได้ตั้งค่า environment variable: ${name}`);
  }
  return value;
}

export function optionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

/**
 * หา origin ของเว็บเพื่อประกอบ redirect_uri ของ LINE Login
 * เรียงลำดับ: ค่าที่ตั้งเอง → header ที่ proxy ของ Vercel ส่งมา → URL ของ request
 */
export function getBaseUrl(req: Request): string {
  const configured = process.env.NEXT_PUBLIC_BASE_URL;
  if (configured) return configured.replace(/\/$/, "");

  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  if (host) {
    const proto = req.headers.get("x-forwarded-proto") ?? (host.startsWith("localhost") ? "http" : "https");
    return `${proto}://${host}`;
  }
  return new URL(req.url).origin;
}
