import { randomUUID } from 'node:crypto'
import type Database from 'better-sqlite3'
import {
  burnPasswordCheck,
  hashAdminPassword,
  validateNewPassword,
  verifyAdminPassword,
} from '../password'
import { safeLog } from '../safe-log'

export const LOGIN_FAILURE_LIMIT = 5
export const LOGIN_LOCK_MS = 30 * 60 * 1_000
export const SESSION_IDLE_MS = 8 * 60 * 60 * 1_000

interface AdminUserRow {
  id: string
  username: string
  passwordHash: string
  sessionVersion: number
  failedLoginCount: number
  lockedUntil: number | null
  active: number
  version: number
}

const selectAdmin = `
  SELECT
    id,
    username,
    password_hash AS passwordHash,
    session_version AS sessionVersion,
    failed_login_count AS failedLoginCount,
    locked_until AS lockedUntil,
    active,
    version
  FROM users
`

function normalizeUsername(username: string) {
  const normalized = username.trim()
  if (normalized.length < 1 || normalized.length > 100) {
    throw new Error('Username must contain 1 to 100 characters.')
  }
  return normalized
}

export function logAuthEvent(
  event: string,
  username: string,
) {
  safeLog(
    event.endsWith('FAILED') ? 'warn' : 'info',
    'Authentication event.',
    {
      event,
      username,
    },
  )
}

export async function initializeAdmin(
  sqlite: Database.Database,
  input: {
    username: string
    password: string
    now?: number
  },
) {
  const username = normalizeUsername(input.username)
  validateNewPassword(input.password)
  const existing = sqlite.prepare(selectAdmin).get() as
    AdminUserRow | undefined

  if (existing) {
    if (existing.username !== username) {
      throw new Error('A different administrator already exists.')
    }

    return {
      created: false,
      id: existing.id,
      username: existing.username,
    }
  }

  const passwordHash = await hashAdminPassword(input.password)
  const id = randomUUID()
  const now = input.now ?? Date.now()

  sqlite.prepare(`
    INSERT INTO users (
      id, username, password_hash, password_changed_at,
      created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?)
  `).run(id, username, passwordHash, now, now, now)
  logAuthEvent('ADMIN_INITIALIZED', username)

  return {
    created: true,
    id,
    username,
  }
}

export async function authenticateAdmin(
  sqlite: Database.Database,
  input: {
    username: string
    password: string
    now?: number
  },
) {
  const username = input.username.trim()
  const now = input.now ?? Date.now()
  const user = sqlite.prepare(`${selectAdmin} WHERE username = ?`)
    .get(username) as AdminUserRow | undefined

  if (!user) {
    await burnPasswordCheck(input.password)
    logAuthEvent('LOGIN_FAILED', username)
    return null
  }

  const passwordMatches = await verifyAdminPassword(
    user.passwordHash,
    input.password,
  )
  const finalized = sqlite.transaction(() => {
    const current = sqlite.prepare(`${selectAdmin} WHERE id = ?`)
      .get(user.id) as AdminUserRow | undefined
    const locked = current?.lockedUntil !== null
      && current?.lockedUntil !== undefined
      && current.lockedUntil > now

    if (
      !current
      || !current.active
      || locked
      || current.passwordHash !== user.passwordHash
      || !passwordMatches
    ) {
      if (current?.active && !locked) {
        const previousFailures = current.lockedUntil !== null
          && current.lockedUntil <= now
          ? 0
          : current.failedLoginCount
        const failedLoginCount = previousFailures + 1
        const lockedUntil = failedLoginCount >= LOGIN_FAILURE_LIMIT
          ? now + LOGIN_LOCK_MS
          : null

        sqlite.prepare(`
          UPDATE users
          SET
            failed_login_count = ?,
            locked_until = ?,
            updated_at = ?
          WHERE id = ?
        `).run(failedLoginCount, lockedUntil, now, current.id)
      }

      return null
    }

    sqlite.prepare(`
      UPDATE users
      SET failed_login_count = 0, locked_until = NULL, updated_at = ?
      WHERE id = ?
    `).run(now, current.id)

    return {
      id: current.id,
      username: current.username,
      sessionVersion: current.sessionVersion,
      version: current.version,
    }
  }).immediate()

  logAuthEvent(
    finalized ? 'LOGIN_SUCCEEDED' : 'LOGIN_FAILED',
    username,
  )
  return finalized
}

export function findActiveAdminById(
  sqlite: Database.Database,
  id: string,
) {
  const user = sqlite.prepare(`${selectAdmin} WHERE id = ?`)
    .get(id) as AdminUserRow | undefined

  if (!user || !user.active) {
    return null
  }

  return {
    id: user.id,
    username: user.username,
    sessionVersion: user.sessionVersion,
    version: user.version,
  }
}

export function invalidateAdminSessions(
  sqlite: Database.Database,
  userId: string,
  now = Date.now(),
) {
  const result = sqlite.prepare(`
    UPDATE users
    SET session_version = session_version + 1, updated_at = ?
    WHERE id = ? AND active = 1
  `).run(now, userId)

  return result.changes === 1
}

export function isSessionIdleExpired(
  lastSeenAt: number,
  now = Date.now(),
) {
  return !Number.isSafeInteger(lastSeenAt)
    || lastSeenAt > now
    || now - lastSeenAt >= SESSION_IDLE_MS
}

export async function changeAdminPassword(
  sqlite: Database.Database,
  input: {
    userId: string
    expectedVersion: number
    currentPassword: string
    newPassword: string
    now?: number
  },
) {
  validateNewPassword(input.newPassword)
  const user = sqlite.prepare(`${selectAdmin} WHERE id = ?`)
    .get(input.userId) as AdminUserRow | undefined

  if (!user || !user.active) {
    return { status: 'unauthorized' as const }
  }

  if (user.version !== input.expectedVersion) {
    return { status: 'conflict' as const }
  }

  if (!await verifyAdminPassword(
    user.passwordHash,
    input.currentPassword,
  )) {
    return { status: 'unauthorized' as const }
  }

  const passwordHash = await hashAdminPassword(input.newPassword)
  const now = input.now ?? Date.now()
  const result = sqlite.prepare(`
    UPDATE users
    SET
      password_hash = ?,
      session_version = session_version + 1,
      version = version + 1,
      failed_login_count = 0,
      locked_until = NULL,
      password_changed_at = ?,
      updated_at = ?
    WHERE id = ? AND version = ?
  `).run(
    passwordHash,
    now,
    now,
    user.id,
    input.expectedVersion,
  )

  if (result.changes !== 1) {
    return { status: 'conflict' as const }
  }

  logAuthEvent('PASSWORD_CHANGED', user.username)
  return {
    status: 'changed' as const,
    version: user.version + 1,
  }
}

export async function resetAdminPassword(
  sqlite: Database.Database,
  input: {
    username: string
    newPassword: string
    now?: number
  },
) {
  const username = normalizeUsername(input.username)
  validateNewPassword(input.newPassword)
  const user = sqlite.prepare(`${selectAdmin} WHERE username = ?`)
    .get(username) as AdminUserRow | undefined

  if (!user) {
    throw new Error('Administrator does not exist.')
  }

  const passwordHash = await hashAdminPassword(input.newPassword)
  const now = input.now ?? Date.now()
  sqlite.prepare(`
    UPDATE users
    SET
      password_hash = ?,
      session_version = session_version + 1,
      version = version + 1,
      failed_login_count = 0,
      locked_until = NULL,
      password_changed_at = ?,
      updated_at = ?
    WHERE id = ?
  `).run(passwordHash, now, now, user.id)
  logAuthEvent('PASSWORD_RESET', username)

  return {
    id: user.id,
    username,
    version: user.version + 1,
  }
}
