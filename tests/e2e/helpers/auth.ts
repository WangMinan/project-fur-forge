import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { resetAdminPassword } from '../../../server/utils/auth'
import { openFixtureDatabase } from './fixture-db'

export const adminBaseURL = 'http://localhost:3100'
export const publicBaseURL = 'http://127.0.0.1:3100'

export const E2E_ADMIN = {
  username: 'e2e-admin',
  password: 'e2e-admin-password-2026',
} as const

export const E2E_DATABASE_FILE = resolve(tmpdir(), 'fur-forge-e2e.db')

interface AdminSessionData {
  user: {
    id: string
    username: string
    version: number
  }
  csrfToken: string
}

export async function loginAsAdmin(page: Page): Promise<AdminSessionData> {
  const response = await page.request.post(`${adminBaseURL}/api/auth/login`, {
    data: {
      username: E2E_ADMIN.username,
      password: E2E_ADMIN.password,
    },
    headers: {
      Origin: adminBaseURL,
    },
  })
  expect(response.status(), 'E2E 管理员登录应成功').toBe(200)
  const body = await response.json() as { data: AdminSessionData }
  return body.data
}

export async function fetchSession(page: Page) {
  return page.request.get(`${adminBaseURL}/api/auth/session`)
}

// 把 E2E 管理员密码重置为固定值，同时清除失败锁定并使既有 Session 全部失效。
// 锁定与改密用例必须在收尾调用，避免污染同库的其他用例。
export async function resetE2EAdmin() {
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)

  try {
    await resetAdminPassword(sqlite, {
      username: E2E_ADMIN.username,
      newPassword: E2E_ADMIN.password,
    })
  }
  finally {
    sqlite.close()
  }
}
