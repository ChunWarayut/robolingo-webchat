import { Redis } from "@upstash/redis";

let client: Redis | null = null;

/**
 * Upstash Redis client (REST — ไม่ใช่ TCP จึงใช้บน serverless ได้ไม่ต้องทำ pooling)
 * integration ของ Vercel ใส่ env ให้เองเป็น KV_REST_API_* หรือ UPSTASH_REDIS_REST_*
 * ขึ้นกับว่าต่อมาทางไหน จึงรองรับทั้งสองชื่อ
 */
export function redis(): Redis {
  if (client) return client;

  const url = process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN;

  if (!url || !token) {
    throw new Error(
      "ไม่พบค่าเชื่อมต่อ Redis — ต้องมี KV_REST_API_URL/KV_REST_API_TOKEN หรือ UPSTASH_REDIS_REST_URL/UPSTASH_REDIS_REST_TOKEN",
    );
  }

  client = new Redis({ url, token });
  return client;
}
