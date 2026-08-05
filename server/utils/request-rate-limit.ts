import { createHash } from 'node:crypto'
import type { H3Event } from 'h3'
import { createApiError } from './api-error'
import { getRuntimeConfig } from './runtime-config'

export const LOGIN_RATE_LIMIT = 30
export const ADMIN_WRITE_RATE_LIMIT = 60
const RATE_LIMIT_WINDOW_MS = 60_000
const MAX_SUBJECTS_PER_TIER = 5_000

export function createFixedWindowLimiter(limit: number, windowMs: number) {
  let count = 0
  let resetAt = 0
  return (now = Date.now()) => {
    if (now >= resetAt) {
      count = 0
      resetAt = now + windowMs
    }
    if (count >= limit) {
      return Math.max(1, Math.ceil((resetAt - now) / 1_000))
    }
    count += 1
    return 0
  }
}

type Tier = 'login' | 'adminWrite'
interface Bucket {
  lastSeenAt: number
  take: ReturnType<typeof createFixedWindowLimiter>
}

const buckets: Record<Tier, Map<string, Bucket>> = {
  login: new Map(),
  adminWrite: new Map(),
}

function tierLimit(tier: Tier) {
  return tier === 'login' ? LOGIN_RATE_LIMIT : ADMIN_WRITE_RATE_LIMIT
}

function prune(tier: Tier, now: number) {
  const values = buckets[tier]
  if (values.size < MAX_SUBJECTS_PER_TIER) return
  for (const [key, bucket] of values) {
    if (now - bucket.lastSeenAt >= RATE_LIMIT_WINDOW_MS * 2) {
      values.delete(key)
    }
  }
  if (values.size >= MAX_SUBJECTS_PER_TIER) {
    const oldest = [...values.entries()]
      .sort((left, right) => left[1].lastSeenAt - right[1].lastSeenAt)
      .slice(0, Math.ceil(MAX_SUBJECTS_PER_TIER / 10))
    oldest.forEach(([key]) => values.delete(key))
  }
}

function bucketFor(tier: Tier, subject: string, now: number) {
  prune(tier, now)
  const existing = buckets[tier].get(subject)
  if (existing) {
    existing.lastSeenAt = now
    return existing
  }
  const created: Bucket = {
    lastSeenAt: now,
    take: createFixedWindowLimiter(tierLimit(tier), RATE_LIMIT_WINDOW_MS),
  }
  buckets[tier].set(subject, created)
  return created
}

export function requestClientSubject(event: H3Event) {
  const address = getRequestIP(event, {
    xForwardedFor: getRuntimeConfig().trustedProxy,
  }) ?? 'unknown'
  return createHash('sha256').update(address).digest('hex').slice(0, 24)
}

export function resetRequestRateLimits() {
  buckets.login.clear()
  buckets.adminWrite.clear()
}

export function assertRequestRateLimit(
  event: H3Event,
  tier: Tier,
  subject: string,
  now = Date.now(),
) {
  const retryAfter = bucketFor(tier, subject, now).take(now)
  if (retryAfter === 0) return
  setResponseHeader(event, 'retry-after', retryAfter)
  throw createApiError(429, 'RATE_LIMITED', 'Too many requests. Try again later.')
}
