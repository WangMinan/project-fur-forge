import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  expect,
  test,
} from '@playwright/test'

/**
 * T05 视觉证据采集：固定三视口截图，供 T08 审查与横向轨道/编辑型网格对比。
 * 产物写入 agent_docs/需求1-兽装工作室主页/implementation/notes/t04-t05/screenshots/。
 */
const evidenceDir = join(
  dirname(fileURLToPath(import.meta.url)),
  '..',
  '..',
  'agent_docs',
  '需求1-兽装工作室主页',
  'implementation',
  'notes',
  't04-t05',
  'screenshots',
)

const VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1440, height: 900, name: '1440x900' },
] as const

for (const viewport of VIEWPORTS) {
  test(`capture grid home at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `home-grid-${viewport.name}-hero.png`),
    })
    await page.screenshot({
      path: join(evidenceDir, `home-grid-${viewport.name}-full.png`),
      fullPage: true,
    })
  })

  test(`capture track home at ${viewport.name}`, async ({ page }) => {
    await page.setViewportSize({ width: viewport.width, height: viewport.height })
    await page.goto('/?featured=track')
    await page.waitForLoadState('networkidle')

    await page.screenshot({
      path: join(evidenceDir, `home-track-${viewport.name}-full.png`),
      fullPage: true,
    })
  })
}

test('capture mobile nav open state', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')

  const trigger = page.getByRole('button', { name: '打开导航' })
  const dialog = page.getByRole('dialog', { name: '站点导航' })

  await expect(async () => {
    await trigger.click()
    await expect(dialog).toBeVisible({ timeout: 1_000 })
  }).toPass({ timeout: 20_000 })

  await page.screenshot({
    path: join(evidenceDir, 'mobile-nav-390x844.png'),
  })
})
