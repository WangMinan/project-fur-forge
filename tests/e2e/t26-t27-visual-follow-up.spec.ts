import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { seedHeroCollections, seedHomeSlides } from './helpers/public-catalog'
import { capture } from './helpers/screenshots'

const SCREENSHOT_DIR
  = 'agent_docs/需求1-兽装工作室主页/implementation/notes/t26-t27/screenshots'

test('作品与自设委托页名字号一致，委托首图引导站内申请并保留备用联系', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '自设委托引导图', sortOrder: 0, enabled: true },
  ], {
    contactEmail: 'hello@example.test',
    contactQq: '123456789',
    tagline: '让角色成为真实作品',
  }, 'commission')

  await page.goto('/works')
  const worksTitleStyle = await page.getByRole('heading', {
    level: 1,
    name: '作品展示',
  }).evaluate(element => ({
    fontSize: getComputedStyle(element).fontSize,
    lineHeight: getComputedStyle(element).lineHeight,
  }))

  await page.goto('/commission')
  const commissionTitle = page.getByRole('heading', { level: 1, name: '自设委托' })
  await expect(commissionTitle).toBeVisible()
  expect(await commissionTitle.evaluate(element => ({
    fontSize: getComputedStyle(element).fontSize,
    lineHeight: getComputedStyle(element).lineHeight,
  }))).toEqual(worksTitleStyle)

  const hero = page.getByTestId('commission-hero')
  await expect(hero).toBeVisible()
  await expect(hero.getByRole('heading', { name: '从角色设定出发' })).toBeVisible()
  await expect(hero.getByRole('link', { name: '提交委托申请' }))
    .toHaveAttribute('href', '/commission/apply')
  await expect(hero.getByRole('link', { name: '查看其他联系方式' }))
    .toHaveAttribute('href', '/about#contact')
  await expect(page.getByRole('link', { name: '打开邮件客户端' })).toHaveAttribute(
    'href',
    /^mailto:hello@example\.test/u,
  )
  const image = hero.locator('img')
  await expect(image).toHaveJSProperty('complete', true)
  expect(await image.evaluate((element: HTMLImageElement) => element.naturalWidth)).toBeGreaterThan(0)

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width, height })
    await expect(hero).toBeVisible()
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${width}×${height} 不应横向溢出`).toBeLessThanOrEqual(1)
    await capture(page, `visual-follow-up-commission-${width}x${height}`, SCREENSHOT_DIR)
  }
})

test('委托页横竖首项可独立维护并随方向更新替代文字', async ({ page }) => {
  await seedHeroCollections(page, {
    placement: 'commission',
    landscape: [{ alt: '委托横版独立首项', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '委托竖版独立首项', sortOrder: 0, enabled: true }],
  })
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/commission')
  const hero = page.getByTestId('commission-hero')
  await expect(hero.getByRole('img', { name: '委托竖版独立首项' })).toBeVisible()

  await page.setViewportSize({ width: 1440, height: 900 })
  await expect(hero.getByRole('img', { name: '委托横版独立首项' })).toBeVisible()
})

test('管理导航提供独立文案配置页', async ({ page }) => {
  await loginAsAdmin(page)
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto(`${adminBaseURL}/admin/site/content`)

  await expect(page.getByRole('heading', { level: 1, name: '文案配置' })).toBeVisible()
  await expect(page.getByRole('navigation', { name: '管理导航' })
    .getByRole('link', { name: '文案配置' }))
    .toHaveAttribute('aria-current', 'page')
  await expect(page.getByRole('heading', { name: '营业状态', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: '页面内容' })).toBeVisible()
  await expect(page.getByRole('button', { name: '新增问题' })).toHaveCount(0)
  await expect(page.getByLabel('邮件联系引导')).toBeVisible()
  await expect(page.getByLabel('QQ账号')).toBeVisible()
  await expect(page.getByLabel('QQ群账号')).toBeVisible()
  const commissionCard = page.getByTestId('site-section-card')
    .filter({ has: page.getByRole('heading', { name: '委托基础文案' }) })
  expect(await commissionCard.evaluate(element => Number.parseFloat(
    getComputedStyle(element).rowGap,
  ))).toBeGreaterThanOrEqual(8)
  await capture(page, 'visual-follow-up-admin-content-1440x900', SCREENSHOT_DIR)

  for (const [width, height] of [[390, 844], [768, 1024], [1440, 900]] as const) {
    await page.setViewportSize({ width, height })
    const overflow = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `${width}×${height} 不应横向溢出`).toBeLessThanOrEqual(1)
  }
})
