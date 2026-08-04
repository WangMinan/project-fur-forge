import type { H3Event } from 'h3'
import { createApiError } from './api-error'

export const LOGIN_RATE_LIMIT = 30
export const ADMIN_WRITE_RATE_LIMIT = 60
const RATE_LIMIT_WINDOW_MS = 60_000

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

// ponytail: global windows match the current single-process, single-admin
// contract; use a shared per-subject store before adding replicas or admins.
function createRequestLimiters() {
  return {
    login: createFixedWindowLimiter(LOGIN_RATE_LIMIT, RATE_LIMIT_WINDOW_MS),
    adminWrite: createFixedWindowLimiter(
      ADMIN_WRITE_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    ),
  }
}

let limiters = createRequestLimiters()

export function resetRequestRateLimits() {
  limiters = createRequestLimiters()
}

export function assertRequestRateLimit(
  event: H3Event,
  tier: keyof typeof limiters,
) {
  const retryAfter = limiters[tier]()
  if (retryAfter === 0) {
    return
  }

  setResponseHeader(event, 'retry-after', retryAfter)
  throw createApiError(
    429,
    'RATE_LIMITED',
    'Too many requests. Try again later.',
  )
}
