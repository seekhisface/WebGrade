/**
 * Simple in-memory rate limiter for API routes.
 * In production, replace with Redis-backed rate limiting (e.g. Upstash).
 */

const counters = new Map<string, { count: number; resetAt: number }>();

/**
 * Check if a request should be rate limited.
 * @param key - Unique key (e.g. IP hash + route)
 * @param route - Route name for namespacing
 * @param limitPerMinute - Max requests per minute
 * @returns true if request is allowed, false if rate limited
 */
export async function checkRateLimit(
  key: string,
  route: string,
  limitPerMinute: number
): Promise<boolean> {
  const fullKey = `${route}:${key}`;
  const now = Date.now();
  const windowMs = 60 * 1000; // 1 minute

  const existing = counters.get(fullKey);

  if (!existing || now > existing.resetAt) {
    counters.set(fullKey, { count: 1, resetAt: now + windowMs });
    return true;
  }

  if (existing.count >= limitPerMinute) {
    return false;
  }

  existing.count++;
  return true;
}
