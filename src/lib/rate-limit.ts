// ============================================================
// src/lib/rate-limit.ts — tiny in-memory fixed-window rate limiter.
//
// Per-instance only (resets on cold start; not shared across Vercel lambdas). Good
// enough as a cheap first line on signed/internal endpoints where HMAC is the real
// gate. For user-facing abuse protection, back this with a shared store later.
// ============================================================

type Bucket = { count: number; resetAt: number }
const buckets = new Map<string, Bucket>()
let lastPrune = 0

export type RateLimitResult = { allowed: boolean; retryAfter: number }

/** Allow up to `limit` hits per `windowMs` for `key`. retryAfter = seconds until reset. */
export function rateLimit(key: string, limit: number, windowMs: number): RateLimitResult {
  const now = Date.now()

  if (now - lastPrune > 60_000) {
    for (const [k, b] of buckets) if (b.resetAt <= now) buckets.delete(k)
    lastPrune = now
  }

  const b = buckets.get(key)
  if (!b || b.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return { allowed: true, retryAfter: 0 }
  }
  if (b.count >= limit) {
    return { allowed: false, retryAfter: Math.ceil((b.resetAt - now) / 1000) }
  }
  b.count += 1
  return { allowed: true, retryAfter: 0 }
}

/** Best-effort client IP from proxy headers (Vercel sets x-forwarded-for). */
export function clientIp(request: Request): string {
  const xff = request.headers.get('x-forwarded-for')
  if (xff) return xff.split(',')[0]!.trim()
  return request.headers.get('x-real-ip') ?? 'unknown'
}

/** Ready 429 response. */
export function tooManyRequests(retryAfter: number): Response {
  return new Response(JSON.stringify({ ok: false, error: 'rate_limited' }), {
    status: 429,
    headers: { 'content-type': 'application/json', 'retry-after': String(retryAfter) },
  })
}
