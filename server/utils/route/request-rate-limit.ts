import type { H3Event } from 'h3'
import { createApiError } from '../api-error'
import {
  resolveTrustedClientAddress,
  subjectDigest,
} from './client-address'
import { getRuntimeConfig } from '../runtime-config'

export const LOGIN_RATE_LIMIT = 30
export const ADMIN_WRITE_RATE_LIMIT = 60
export const ADMIN_PROBE_RATE_LIMIT = 60
const RATE_LIMIT_WINDOW_MS = 60_000
/** 桶数量上限，防止伪造大量 subject 撑爆内存。 */
const MAX_BUCKETS_PER_TIER = 4_096

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

interface Bucket {
  count: number
  resetAt: number
}

/**
 * T34-F5 按主体分桶的固定窗口限流。
 *
 * 单实例下继续使用内存计数，但**不再使用全局计数器**：
 * 匿名流量无法再耗尽唯一管理员的窗口。
 */
export function createSubjectLimiter(limit: number, windowMs: number) {
  const buckets = new Map<string, Bucket>()

  return (subject: string, now = Date.now()) => {
    // 顺带清理过期桶，避免长期累积。
    if (buckets.size > MAX_BUCKETS_PER_TIER) {
      for (const [key, bucket] of buckets) {
        if (now >= bucket.resetAt) {
          buckets.delete(key)
        }
      }
    }
    const existing = buckets.get(subject)
    if (!existing || now >= existing.resetAt) {
      buckets.set(subject, { count: 1, resetAt: now + windowMs })
      return 0
    }
    if (existing.count >= limit) {
      return Math.max(1, Math.ceil((existing.resetAt - now) / 1_000))
    }
    existing.count += 1
    return 0
  }
}

function createRequestLimiters() {
  return {
    // 登录：可信客户端 IP 摘要 + 用户名摘要，两者都参与分桶。
    login: createSubjectLimiter(LOGIN_RATE_LIMIT, RATE_LIMIT_WINDOW_MS),
    // 已认证管理写：按管理员 ID。
    adminWrite: createSubjectLimiter(
      ADMIN_WRITE_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    ),
    // 未认证管理探测：按可信客户端 IP 摘要。
    adminProbe: createSubjectLimiter(
      ADMIN_PROBE_RATE_LIMIT,
      RATE_LIMIT_WINDOW_MS,
    ),
  }
}

let limiters = createRequestLimiters()

export function resetRequestRateLimits() {
  limiters = createRequestLimiters()
}

export function trustedClientDigest(event: H3Event) {
  const config = getRuntimeConfig() as { trustedProxyCidrs?: string }
  return subjectDigest(resolveTrustedClientAddress(
    getRequestIP(event) ?? '',
    getHeader(event, 'x-forwarded-for'),
    config.trustedProxyCidrs,
  ))
}

export interface RateLimitSubject {
  /** 已认证管理员 ID，用于 adminWrite 分桶。 */
  adminId?: string
  /** 登录用户名，与 IP 摘要共同分桶。 */
  username?: string
}

export function rateLimitSubjectKey(
  event: H3Event,
  tier: 'adminProbe' | 'adminWrite' | 'login',
  subject: RateLimitSubject = {},
) {
  if (tier === 'adminWrite' && subject.adminId) {
    return `admin:${subject.adminId}`
  }
  const parts = [`ip:${trustedClientDigest(event)}`]
  if (tier === 'login' && subject.username) {
    parts.push(`user:${subjectDigest(subject.username.toLowerCase())}`)
  }
  return parts.join('|')
}

export function assertRequestRateLimit(
  event: H3Event,
  tier: keyof typeof limiters,
  subject: RateLimitSubject = {},
) {
  const retryAfter = limiters[tier](rateLimitSubjectKey(event, tier, subject))
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
