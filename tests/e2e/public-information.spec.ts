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

test('委托合并导航复用下拉并保持两个业务路由可达', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto('/commission')

  const header = page.getByTestId('public-header')
  const commissionLink = header.getByRole('link', { name: '委托', exact: true })
  const commissionSubnav = header.getByRole('navigation', { name: '委托二级导航' })
  const commissionPanel = commissionSubnav
  await expect(header.getByRole('link', { name: '角色领养', exact: true })).toHaveCount(0)
  await expect(commissionLink).toHaveAttribute('href', '/commission')
  await expect(commissionLink).toHaveAttribute('aria-current', 'page')
  await expect(commissionSubnav).toBeHidden()

  await commissionLink.hover()
  await expect(commissionSubnav).toBeVisible()
  await expect(commissionSubnav.getByRole('link', { name: '自设委托' }))
    .toHaveAttribute('href', '/commission')
  await expect(commissionSubnav.getByRole('link', { name: '掉落领养' }))
    .toHaveAttribute('href', '/adoptions')
  const expectedRadius = await page.evaluate(() => {
    const probe = document.createElement('div')
    probe.style.borderRadius = 'var(--radius-lg)'
    document.body.append(probe)
    const radius = getComputedStyle(probe).borderTopLeftRadius
    probe.remove()
    return radius
  })
  await expect(commissionPanel).toHaveCSS('border-top-left-radius', expectedRadius)

  await page.mouse.move(0, 0)
  await page.getByRole('link', { name: '首页', exact: true }).first().focus()
  await expect(commissionSubnav).toBeHidden()
  await commissionLink.focus()
  await expect(commissionSubnav).toBeVisible()
  await commissionSubnav.getByRole('link', { name: '掉落领养' }).click()
  await expect(page).toHaveURL(/\/adoptions$/u)
  await expect(
    page.getByTestId('public-header')
      .locator('.public-header__nav-item--active')
      .getByRole('link', { name: '委托', exact: true }),
  ).toBeVisible()

  await page.setViewportSize({ width: 390, height: 844 })
  await page.getByRole('button', { name: '打开导航' }).click()
  const mobileNav = page.getByTestId('public-mobile-nav')
  await expect(mobileNav.getByRole('link', { name: '自设委托' }))
    .toHaveAttribute('href', '/commission')
  await expect(mobileNav.getByRole('link', { name: '掉落领养' }))
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
