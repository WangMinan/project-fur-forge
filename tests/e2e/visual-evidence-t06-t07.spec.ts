import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { test } from '@playwright/test'

/**
 * T06/T07 视觉证据采集（T08 评审材料）：
 * 固定三视口 390×844 / 768×1024 / 1440×900，覆盖
 * /works、作品详情、后台登录、后台作品列表、后台作品编辑。
 * 产物写入 agent_docs/需求1-兽装工作室主页/implementation/notes/t06-t07/screenshots/。
 */
const evidenceDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'agent_docs',
  '需求1-兽装工作室主页',
  'implementation',
  'notes',
  't06-t07',
  'screenshots',
)

const adminBaseURL = 'http://localhost:3100'
const BLUEBERRY_ID = 'b943ee7e-0e9a-4944-a36b-ed61b8b9a640'
const LIZI_ID = '3cb1db83-c2c5-42a1-8e5e-a61cb97d2422'

const VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1440, height: 900, name: '1440x900' },
] as const

for (const viewport of VIEWPORTS) {
  test(`capture works list at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/works')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `works-list-${viewport.name}-full.png`),
      fullPage: true,
    })
  })

  test(`capture work detail (blueberry, adoption) at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/works/blueberry')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `work-detail-blueberry-${viewport.name}-full.png`),
      fullPage: true,
    })
  })

  test(`capture admin login at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.waitForSelector('[data-testid="admin-login"]')

    await page.screenshot({
      path: join(evidenceDir, `admin-login-${viewport.name}.png`),
    })
  })

  test(`capture admin works list at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto(`${adminBaseURL}/admin/works`)
    await page.waitForSelector('.works-page__header')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `admin-works-${viewport.name}-full.png`),
      fullPage: true,
    })
  })

  test(`capture admin editor (blueberry) at ${viewport.name}`, async ({ page }) => {
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

test('capture work detail gallery (naigai) at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/works/naigai')
  await page.waitForLoadState('networkidle')

  await page.screenshot({
    path: join(evidenceDir, 'work-detail-naigai-1440x900-full.png'),
    fullPage: true,
  })
})

test('capture admin editor blocked state (lizi) at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${adminBaseURL}/admin/works/${LIZI_ID}`)
  await page.waitForSelector('.editor-card')
  await page.waitForLoadState('networkidle')

  await page.screenshot({
    path: join(evidenceDir, 'admin-editor-lizi-blocked-1440x900-full.png'),
    fullPage: true,
  })
})

test('capture admin login error sample at 390x844', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto(`${adminBaseURL}/admin/login?state=error`)
  await page.waitForSelector('[data-testid="admin-login"]')

  await page.screenshot({
    path: join(evidenceDir, 'admin-login-error-390x844.png'),
  })
})

test('capture admin works empty sample at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${adminBaseURL}/admin/works?state=empty`)
  await page.waitForSelector('.works-page__empty')

  await page.screenshot({
    path: join(evidenceDir, 'admin-works-empty-1440x900.png'),
  })
})

test('capture public works empty-filter state at 1440x900', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/works?purpose=adoption&suit=partial')
  await page.waitForLoadState('networkidle')

  await page.screenshot({
    path: join(evidenceDir, 'works-list-empty-1440x900.png'),
  })
})
