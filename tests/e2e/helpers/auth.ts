import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { resetAdminPassword } from '../../../server/utils/service/auth'
import { openFixtureDatabase } from './fixture-db'

function requiredEnvironment(name: string) {
  const value = process.env[name]
  if (!value) {
    throw new Error(`${name} must be set by playwright.config.ts.`)
  }
  return value
}

export const adminBaseURL = requiredEnvironment('E2E_ADMIN_BASE_URL')
export const publicBaseURL = requiredEnvironment('E2E_PUBLIC_BASE_URL')
export const E2E_RUN_DIRECTORY = requiredEnvironment('E2E_RUN_DIRECTORY')

export const E2E_ADMIN = {
  username: 'e2e-admin',
  password: 'e2e-admin-password-2026',
} as const

export const E2E_DATABASE_FILE = requiredEnvironment('E2E_DATABASE_FILE')

interface AdminSessionData {
  user: {
    id: string
    username: string
    version: number
  }
  csrfToken: string
}

export async function loginAsAdmin(page: Page): Promise<AdminSessionData> {
  const reset = await page.request.post(
    `${adminBaseURL}/api/e2e-fake-media-control`,
    { data: { action: 'resetRateLimits' } },
  )
  expect(reset.ok(), 'E2E 限流窗口应在用例边界重置').toBeTruthy()

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
