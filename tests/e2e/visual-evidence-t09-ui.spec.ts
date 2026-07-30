import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'

/**
 * T09 界面修补视觉证据采集：
 * - 首页 Hero 换新背景样张与确定性 scrim 后的三视口截图；
 * - 管理端独立布局（无公开 Header/Footer）的三视口截图。
 * 产物写入 agent_docs/需求1-兽装工作室主页/implementation/notes/t09-ui/screenshots/。
 */
const evidenceDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'agent_docs',
  '需求1-兽装工作室主页',
  'implementation',
  'notes',
  't09-ui',
  'screenshots',
)

const adminBaseURL = 'http://localhost:3100'
const BLUEBERRY_ID = 'b943ee7e-0e9a-4944-a36b-ed61b8b9a640'

const VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1440, height: 900, name: '1440x900' },
] as const

for (const viewport of VIEWPORTS) {
  test(`capture home hero at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `home-hero-${viewport.name}.png`),
    })
    await page.screenshot({
      path: join(evidenceDir, `home-${viewport.name}-full.png`),
      fullPage: true,
    })
  })

  test(`capture admin works at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`${adminBaseURL}/admin/works`)
    await page.waitForSelector('.works-page__header')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `admin-works-${viewport.name}-full.png`),
      fullPage: true,
    })
  })

  test(`capture admin editor at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
    await page.waitForSelector('.editor-card')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `admin-editor-blueberry-${viewport.name}-full.png`),
      fullPage: true,
    })
  })
}

test('capture admin login at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminBaseURL}/admin/login`)
  await page.waitForSelector('[data-testid="admin-login"]')

  await page.screenshot({
    path: join(evidenceDir, 'admin-login-390x844.png'),
  })
})
