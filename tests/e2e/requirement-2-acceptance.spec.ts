import { expect, test } from '@playwright/test'
import {
  adminBaseURL,
  loginAsAdmin,
  publicBaseURL,
} from './helpers/auth'
import { seedPublicUpdates } from './helpers/public-updates'
import { capture } from './helpers/screenshots'
import {
  resetFakeMedia,
  resetOfficialChannels,
} from './helpers/fake-media'
import {
  seedHomeSlides,
  seedPublicCatalog,
  seedPublicReturns,
} from './helpers/public-catalog'

const SCREENSHOT_DIR
  = 'agent_docs/需求2-站点导航与内容增强/implementation/notes/t15/screenshots'

const viewports = [
  { width: 390, height: 844 },
  { width: 768, height: 1024 },
  { width: 1440, height: 900 },
] as const

function observeRuntime(page: import('@playwright/test').Page) {
  const consoleErrors: string[] = []
  const failedResponses: string[] = []
  const requestFailures: string[] = []

  page.on('console', (message) => {
    if (message.type() === 'error') {
      consoleErrors.push(message.text())
    }
  })
  page.on('response', (response) => {
    if (response.status() >= 400) {
      failedResponses.push(`${response.status()} ${response.url()}`)
    }
  })
  page.on('requestfailed', (request) => {
    requestFailures.push(`${request.failure()?.errorText ?? 'failed'} ${request.url()}`)
  })

  return { consoleErrors, failedResponses, requestFailures }
}

async function expectNoOverflow(page: import('@playwright/test').Page) {
  expect(await page.evaluate(() => (
    document.documentElement.scrollWidth - document.documentElement.clientWidth
  ))).toBeLessThanOrEqual(1)
}

test('需求2公开与管理关键页面在双 Host 三视口无 console/network 错误', async ({ page }) => {
  test.setTimeout(180_000)
  const runtime = observeRuntime(page)
  // 全量套件共享夹具库；先移除前序媒体用例的数据库引用并清空内存对象，
  // 避免把不存在的旧预览误判成当前需求2页面的网络错误。
  await resetOfficialChannels(page)
  await seedHomeSlides(page, [])
  await seedHomeSlides(page, [], undefined, 'commission')
  await seedPublicCatalog(page, [])
  await seedPublicReturns(page, [])
  await resetFakeMedia(page)
  await seedPublicUpdates(page, [{
    type: 'event',
    title: 'E2E 公开动态 T15 验收',
    content: '用于双 Host 与三视口验收。',
  }])
  await loginAsAdmin(page)

  for (const viewport of viewports) {
    await page.setViewportSize(viewport)

    for (const path of ['/', '/works', '/adoptions', '/returns', '/updates', '/about']) {
      await page.goto(`${publicBaseURL}${path}`)
      expect(new URL(page.url()).hostname).toBe('127.0.0.1')
      await expect(page.getByTestId('public-header')).toBeVisible()
      await page.waitForTimeout(100)
      await expectNoOverflow(page)
    }

    for (const path of ['/admin/updates', '/admin/site/content', '/admin/account']) {
      await page.goto(`${adminBaseURL}${path}`)
      expect(new URL(page.url()).hostname).toBe('localhost')
      await expect(page.getByTestId('admin-shell')).toBeVisible()
      await expect(page.getByRole('button', { name: '退出登录' })).toBeVisible()
      await page.waitForTimeout(100)
      await expectNoOverflow(page)
    }

    await capture(
      page,
      `admin-account-${viewport.width}x${viewport.height}`,
      SCREENSHOT_DIR,
    )

    const username = page.locator('.admin-shell__user')
    if (viewport.width >= 1280) {
      await expect(username).toHaveText('e2e-admin')
      await expect(username).toBeVisible()
    }
    else {
      await expect(username).toBeHidden()
    }

  }

  expect(runtime.consoleErrors).toEqual([])
  expect(runtime.failedResponses).toEqual([])
  expect(runtime.requestFailures).toEqual([])
})
