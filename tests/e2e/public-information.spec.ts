import { expect, test } from '@playwright/test'
import { seedHomeSlides } from './helpers/public-catalog'

test('关于二级导航、独立条款页、页脚与兼容跳转连通', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/about')

  await expect(page.getByTestId('about-contact')).toBeVisible()
  const header = page.getByTestId('public-header')
  const aboutLink = header.getByRole('link', { name: '关于我们', exact: true }).first()
  const subnav = header.getByRole('navigation', { name: '关于我们二级导航' })
  await expect(subnav).toBeHidden()
  await aboutLink.hover()
  await expect(subnav).toBeVisible()
  await subnav.getByRole('link', { name: '服务条款' }).click()
  await expect(page).toHaveURL(/\/service$/u)
  await expect(page.getByRole('heading', { level: 1, name: '服务条款' })).toBeVisible()
  await expect(page.getByText('保修期自客户签收之日起一年', { exact: false })).toBeVisible()

  await page.goto('/privacy')
  await expect(page.getByRole('heading', { level: 1, name: '隐私政策' })).toBeVisible()
  await expect(page.getByText('公开站不提供访客账号', { exact: false })).toBeVisible()
  await expect(page.getByText('原始记录保留 90 天', { exact: false })).toBeVisible()
  await expect(page.getByText('未来如新增会影响访客的信息处理功能', { exact: false }))
    .toHaveCount(0)

  const footer = page.locator('.public-footer')
  await expect(footer.getByRole('link', { name: '服务条款' })).toBeVisible()
  await expect(footer.getByRole('link', { name: '隐私政策' })).toBeVisible()
  await expect(footer.getByRole('link', { name: 'ICP备案' })).toHaveCount(0)
  await expect(footer).not.toContainText('待备案')
  await expect(footer.getByRole('link', { name: 'Arktouros' })).toHaveAttribute(
    'href',
    'https://github.com/wangminan',
  )
  await expect(footer).not.toContainText('业务邮箱')
  await expect(footer).not.toContainText('QQ 3114559925')

  await page.goto('/contact')
  await expect(page).toHaveURL(/\/about#contact$/u)
  await expect(page.getByTestId('about-contact')).toBeVisible()
  await page.goto('/terms')
  await expect(page).toHaveURL(/\/service$/u)
})

test('自设委托与设定领养作为一级导航直接可达', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/commission')

  const header = page.getByTestId('public-header')
  const commissionLink = header.getByRole('link', { name: '自设委托', exact: true })
  const adoptionLink = header.getByRole('link', { name: '设定领养', exact: true })
  await expect(header.getByRole('navigation', { name: '委托二级导航' })).toHaveCount(0)
  await expect(header.getByRole('link', { name: '委托', exact: true })).toHaveCount(0)
  await expect(header.getByRole('link', { name: '角色领养', exact: true })).toHaveCount(0)
  await expect(header.getByRole('link', { name: '掉落领养', exact: true })).toHaveCount(0)
  await expect(commissionLink).toHaveAttribute('href', '/commission')
  await expect(adoptionLink).toHaveAttribute('href', '/adoptions')
  await expect(commissionLink).toHaveAttribute('aria-current', 'page')
  await adoptionLink.click()
  await expect(page).toHaveURL(/\/adoptions$/u)
  await expect(
    page.getByTestId('public-header')
      .getByRole('link', { name: '设定领养', exact: true }),
  ).toHaveAttribute('aria-current', 'page')

  await page.setViewportSize({ width: 768, height: 1024 })
  await expect(page.getByTestId('public-header').getByRole('navigation', { name: '主导航' }))
    .toBeHidden()
  await page.getByRole('button', { name: '打开导航' }).click()
  const mobileNav = page.getByTestId('public-mobile-nav')
  await expect(mobileNav.getByRole('link', { name: '自设委托' }))
    .toHaveAttribute('href', '/commission')
  await expect(mobileNav.getByRole('link', { name: '设定领养' }))
    .toHaveAttribute('href', '/adoptions')
})

test('移动导航可达法律页，委托状态框为圆角矩形且三视口无溢出', async ({ page }) => {
  await seedHomeSlides(page, [
    { alt: '委托页圆角状态框测试图', sortOrder: 0, enabled: true },
  ], undefined, 'commission')

  for (const { width, height } of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize({ width, height })
    await page.goto('/commission')
    const status = page.locator('.commission-lead__status')
    await expect(status).toBeVisible()
    expect(await status.evaluate(element =>
      Number.parseFloat(getComputedStyle(element).borderTopLeftRadius),
    )).toBeLessThan(100)
    expect(await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )).toBeLessThanOrEqual(1)
  }

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/about')
  await page.getByRole('button', { name: '打开导航' }).click()
  const mobileNav = page.getByTestId('public-mobile-nav')
  await expect(mobileNav.getByRole('link', { name: '服务条款' })).toBeVisible()
  await expect(mobileNav.getByRole('link', { name: '隐私政策' })).toBeVisible()
})

test('公开移动抽屉错峰进场，并共用焦点陷阱、Escape、滚动锁定与减弱动效', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/about')

  const trigger = page.getByRole('button', { name: '打开导航' })
  await trigger.click()
  const drawer = page.getByTestId('public-mobile-nav')
  await expect(drawer).toBeVisible()
  expect(await page.locator('html').evaluate(element => element.style.overflow)).toBe('hidden')
  expect(await page.locator('main').evaluate(element => element.inert)).toBe(true)

  const close = drawer.getByRole('button', { name: '关闭导航' })
  const lastLink = drawer.getByRole('link', { name: '隐私政策' })
  await expect(close).toBeFocused()
  await page.keyboard.press('Shift+Tab')
  await expect(lastLink).toBeFocused()
  await page.keyboard.press('Tab')
  await expect(close).toBeFocused()

  const itemMotion = await drawer.locator('.mobile-nav__item').evaluateAll(items => items.map((item) => {
    const style = getComputedStyle(item)
    return {
      animationName: style.animationName,
      animationDelay: Number.parseFloat(style.animationDelay) * 1000,
    }
  }))
  expect(itemMotion.every(item => /^mobile-nav-item-in-/u.test(item.animationName))).toBe(true)
  expect(itemMotion.map(item => item.animationDelay)).toEqual(
    [...itemMotion.map(item => item.animationDelay)].sort((left, right) => left - right),
  )
  expect(new Set(itemMotion.map(item => item.animationDelay)).size).toBe(itemMotion.length)

  await page.keyboard.press('Escape')
  await expect(drawer).toBeHidden()
  await expect(trigger).toBeFocused()
  expect(await page.locator('html').evaluate(element => element.style.overflow)).toBe('')
  expect(await page.locator('main').evaluate(element => element.inert)).toBe(false)

  await page.emulateMedia({ reducedMotion: 'reduce' })
  await trigger.click()
  await expect(drawer).toBeVisible()
  expect(await drawer.evaluate(element => (
    Math.max(...getComputedStyle(element).transitionDuration.split(',').map(value => (
      Number.parseFloat(value) * 1000
    )))
  ))).toBeLessThanOrEqual(0.02)
  await expect(drawer.locator('.mobile-nav__item').first()).toHaveCSS('animation-name', 'none')
})
