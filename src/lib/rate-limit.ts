import { prisma } from "@/lib/prisma";

const WINDOW_MS = 60 * 60 * 1000;
const DEFAULT_LIMIT = Number(process.env.AUTH_RATE_LIMIT_PER_HOUR ?? 10);

/** Returns true if the action is still allowed, false once the limit for this key+window is exceeded. */
export async function checkRateLimit(key: string, limit = DEFAULT_LIMIT, windowMs = WINDOW_MS) {
  const windowStart = new Date(Math.floor(Date.now() / windowMs) * windowMs);
  const usage = await prisma.rateLimitBucket.upsert({
    where: { key_windowStart: { key, windowStart } },
    create: { key, windowStart, count: 1 },
    update: { count: { increment: 1 } },
  });
  return usage.count <= limit;
}

/** Best-effort client IP from standard proxy headers; falls back to "unknown" (which still rate-limits, just as one shared bucket). */
export function getClientIp(headers: Headers) {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();
  return headers.get("x-real-ip") ?? "unknown";
}
