// ============================================================
// HMAC-SHA256 request signing — Core (superadmin) ⇄ Pharmacy Portal billing sync.
// Server-only (node crypto + env secret). Do NOT import from client components.
//
// Base string = `${timestamp}\n${nonce}\n${rawBody}`. Digest HEX. Verification uses
// timing-safe compare + a 5-minute skew window + (optional) nonce-replay store.
// Shared scheme across JA portals (mirrors ja-lms-platform/lib/portal/sign.ts).
// ============================================================
import crypto from 'crypto'

export const SIG_HEADERS = {
  timestamp: 'x-ja-timestamp',
  nonce: 'x-ja-nonce',
  signature: 'x-ja-signature',
  idempotency: 'idempotency-key',
} as const

export const MAX_SKEW_MS = 5 * 60_000 // 5 minutes

function signBase(timestamp: string, nonce: string, rawBody: string): string {
  return `${timestamp}\n${nonce}\n${rawBody}`
}

/** HMAC-SHA256 hex over the base string. */
export function signPayload(secret: string, timestamp: string, nonce: string, rawBody: string): string {
  return crypto.createHmac('sha256', secret).update(signBase(timestamp, nonce, rawBody)).digest('hex')
}

/** Per-request nonce (128-bit hex). */
export function newNonce(): string {
  return crypto.randomBytes(16).toString('hex')
}

/** Epoch-ms timestamp as a string (X-JA-Timestamp header). */
export function newTimestamp(): string {
  return String(Date.now())
}

function timingSafeEqualHex(a: string, b: string): boolean {
  const ab = Buffer.from(a)
  const bb = Buffer.from(b)
  if (ab.length !== bb.length) return false
  return crypto.timingSafeEqual(ab, bb)
}

export type VerifyReason = 'missing' | 'skew' | 'bad_signature' | 'replay'
export type VerifyResult = { ok: true } | { ok: false; reason: VerifyReason }

/**
 * Verify an incoming signed request. `seenNonce(nonce)` optional: return true when a
 * nonce has already been used (replay) → reject.
 */
export function verifySignedRequest(opts: {
  secret: string
  timestamp: string | null
  nonce: string | null
  signature: string | null
  rawBody: string
  now?: number
  seenNonce?: (nonce: string) => boolean
}): VerifyResult {
  const { secret, timestamp, nonce, signature, rawBody } = opts
  if (!timestamp || !nonce || !signature) return { ok: false, reason: 'missing' }

  const ts = Number(timestamp)
  const now = opts.now ?? Date.now()
  if (!Number.isFinite(ts) || Math.abs(now - ts) > MAX_SKEW_MS) return { ok: false, reason: 'skew' }

  const expected = signPayload(secret, timestamp, nonce, rawBody)
  if (!timingSafeEqualHex(signature, expected)) return { ok: false, reason: 'bad_signature' }

  if (opts.seenNonce && opts.seenNonce(nonce)) return { ok: false, reason: 'replay' }
  return { ok: true }
}
