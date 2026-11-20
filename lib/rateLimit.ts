import { redis } from "./redis";

export type RateLimitResult = {
  allowed: boolean;
  /** เหลือกี่ครั้งในหน้าต่างเวลานี้ */
  remaining: number;
  /** ต้องรออีกกี่วินาทีถ้าโดนจำกัด */
  retryAfter: number;
};

/**
 * นับจำนวนครั้งต่อ key ในหน้าต่างเวลาแบบ fixed window
 * ตั้ง TTL เฉพาะครั้งแรกที่นับ หน้าต่างจึงเริ่มจากความพยายามครั้งแรกและหมดอายุไปเอง
 *
 * ถ้า Redis มีปัญหาจะ "ปล่อยผ่าน" แทนที่จะปิดประตู เพราะการล็อกคนออกจากระบบ
 * ทั้งหมดเพราะที่เก็บสถิติล่ม เสียหายกว่าการยอมให้เดารหัสผ่านต่ออีกชั่วครู่
 */
export async function hitRateLimit(
  key: string,
  limit: number,
  windowSeconds: number,
): Promise<RateLimitResult> {
  try {
    const client = redis();
    const count = await client.incr(key);

    if (count === 1) {
      await client.expire(key, windowSeconds);
    }

    const ttl = count > limit ? await client.ttl(key) : 0;

    return {
      allowed: count <= limit,
      remaining: Math.max(0, limit - count),
      retryAfter: ttl > 0 ? ttl : windowSeconds,
    };
  } catch (error) {
    console.error("[rateLimit] นับไม่ได้ ปล่อยผ่านไปก่อน:", error);
    return { allowed: true, remaining: limit, retryAfter: 0 };
  }
}

export async function resetRateLimit(key: string): Promise<void> {
  try {
    await redis().del(key);
  } catch {
    // ไม่เป็นไร เดี๋ยวหน้าต่างก็หมดอายุเอง
  }
}

/** ที่อยู่ของผู้เรียกตาม header ที่ proxy ของ Vercel ใส่มาให้ */
export function clientIp(req: Request): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}
