import {
  randomBytes,
  timingSafeEqual,
} from 'node:crypto'
import type { H3Event } from 'h3'
import { createApiError } from './api-error'
import {
  findActiveAdminById,
  isSessionIdleExpired,
} from './auth'
import { getDatabase } from './database'
import { getRuntimeConfig } from './runtime-config'

export interface AdminSession {
  user: {
    id: string
    username: string
    version: number
  }
  csrfToken: string
  secure: {
    sessionVersion: number
    lastSeenAt: number
  }
}

function matches(left: string, right: string) {
  const leftBuffer = Buffer.from(left)
  const rightBuffer = Buffer.from(right)
  return leftBuffer.length === rightBuffer.length
    && timingSafeEqual(leftBuffer, rightBuffer)
}

export function assertAdminOrigin(event: H3Event) {
  const expected = new URL(getRuntimeConfig().adminBaseUrl).origin
  const origin = getHeader(event, 'origin')

  if (!origin || !matches(origin, expected)) {
    throw createApiError(403, 'FORBIDDEN', 'Request was rejected.')
  }
}

export function assertCsrfToken(
  event: H3Event,
  expectedToken: string,
) {
  const suppliedToken = getHeader(event, 'x-csrf-token')

  if (!suppliedToken || !matches(suppliedToken, expectedToken)) {
    throw createApiError(403, 'FORBIDDEN', 'Request was rejected.')
  }
}

export function newCsrfToken() {
  return randomBytes(32).toString('base64url')
}

export async function startAdminSession(
  event: H3Event,
  user: {
    id: string
    username: string
    version: number
    sessionVersion: number
  },
  now = Date.now(),
) {
  const csrfToken = newCsrfToken()
  await replaceUserSession(event, {
    user: {
      id: user.id,
      username: user.username,
      version: user.version,
    },
    csrfToken,
    secure: {
      sessionVersion: user.sessionVersion,
      lastSeenAt: now,
    },
  })

  return {
    user: {
      id: user.id,
      username: user.username,
      version: user.version,
    },
    csrfToken,
  }
}

export async function requireAdminSession(
  event: H3Event,
  now = Date.now(),
): Promise<AdminSession> {
  const session = await getUserSession(event)
  const user = session.user
  const secure = session.secure

  if (
    !user
    || !session.csrfToken
    || !secure
    || isSessionIdleExpired(secure.lastSeenAt, now)
  ) {
    await clearUserSession(event)
    throw createApiError(401, 'UNAUTHORIZED', 'Authentication required.')
  }

  const current = findActiveAdminById(getDatabase().sqlite, user.id)
  if (
    !current
    || current.sessionVersion !== secure.sessionVersion
  ) {
    await clearUserSession(event)
    throw createApiError(401, 'UNAUTHORIZED', 'Authentication required.')
  }

  const refreshed = {
    user: {
      id: current.id,
      username: current.username,
      version: current.version,
    },
    csrfToken: session.csrfToken,
    secure: {
      sessionVersion: current.sessionVersion,
      lastSeenAt: now,
    },
  }
  await replaceUserSession(event, refreshed)
  return refreshed
}

export async function endAdminSession(event: H3Event) {
  await clearUserSession(event)
}

export function adminSessionFor(event: H3Event) {
  const session = event.context.adminSession
  if (!session) {
    throw new Error('Admin session middleware did not run.')
  }
  return session
}
