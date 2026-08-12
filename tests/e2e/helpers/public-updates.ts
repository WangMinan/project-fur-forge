import { expect } from '@playwright/test'
import type { Page } from '@playwright/test'
import { adminBaseURL } from './auth'

export interface SeedUpdate {
  content: string
  publicationStatus?: 'draft' | 'published' | 'unpublished'
  publishedAt?: number
  title: string
  type: 'event' | 'drop' | 'commission_open' | 'other'
}

export async function seedPublicUpdates(page: Page, updates: SeedUpdate[]) {
  const response = await page.request.post(
    `${adminBaseURL}/api/e2e-fake-media-control`,
    { data: { action: 'seedPublicUpdates', updates } },
  )
  expect(response.ok(), '公开动态 E2E 数据应成功写入测试数据库').toBeTruthy()
}
