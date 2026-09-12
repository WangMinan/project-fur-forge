import { expect, test } from '@playwright/test'
import { adminBaseURL, publicBaseURL } from '../e2e/helpers/auth'
import { seedHeroCollections, seedPublicCatalog } from '../e2e/helpers/public-catalog'
import { smallStudioPng } from '../e2e/helpers/fake-media'
import { mkdirSync } from 'node:fs'

test('public language SSR, preference, contact branches and responsive switcher', async ({ page, browser, request }) => {
  test.setTimeout(180_000)
  await seedPublicCatalog(page, Array.from({ length: 13 }, (_, index) => ({
    slug: index === 0 ? 'e2e-public-r7-language-character' as const : `e2e-public-r7-character-${index}` as const,
    characterName: index === 0 ? '小狗' : `角色${index}`, species: '犬科',
    purpose: 'adoption', adoptionStatus: 'available', priceCnyMinor: 120000,
    featured: true, sortOrder: 0, photos: [{ alt: '小狗出厂照' }],
    adoptionCover: { alt: '小狗设定图', width: 1920, height: 1080 },
  })))
  await seedHeroCollections(page, { landscape: [{ alt: '测试横图', sortOrder: 0, enabled: true }], portrait: [{ alt: '测试竖图', sortOrder: 0, enabled: true }] })
  for (const [header, language] of [
    ['en-US,zh-CN;q=0.8', 'en'], ['zh-TW,en;q=0.8', 'zh-CN'],
    ['ja-JP', 'zh-CN'], ['', 'zh-CN'], ['en;q=0', 'zh-CN'],
  ]) {
    const response = await request.get(`${publicBaseURL}/about`, { headers: { 'accept-language': header!, cookie: '' } })
    expect(response.status()).toBe(200)
    expect((await response.text()).match(/<html[^>]+lang="([^"]+)"/)?.[1], header).toBe(language)
  }
  for (const [cookie, language] of [['site-language=zh-CN', 'zh-CN'], ['site-language=invalid', 'en']]) {
    const response = await request.get(`${publicBaseURL}/about`, { headers: { 'accept-language': 'en-US', cookie: cookie! } })
    expect((await response.text()).match(/<html[^>]+lang="([^"]+)"/)?.[1]).toBe(language)
  }
  const context = await browser.newContext({ locale: 'en-US', reducedMotion: 'reduce' })
  const english = await context.newPage()
  const errors: string[] = []
  english.on('pageerror', error => errors.push(error.message))
  english.on('console', message => { if (/hydration/i.test(message.text())) errors.push(message.text()) })
  try {
    const sitemap = await (await request.get(`${publicBaseURL}/sitemap.xml`)).text()
    expect((sitemap.match(/\/works\/e2e-public-r7-/g) ?? []).length).toBe(13)
    await english.goto(`${publicBaseURL}/works?page=2`)
    await expect(english.locator('link[rel="canonical"]')).toHaveAttribute('href', `${publicBaseURL}/works?page=2`)
    await english.goto(`${publicBaseURL}/works?q=test`)
    await expect(english.locator('meta[name="robots"]')).toHaveAttribute('content', 'noindex, follow')
    await english.goto(`${publicBaseURL}/about#contact`)
    await expect(english.locator('html')).toHaveAttribute('lang', 'en')
    await expect(english.getByRole('heading', { name: 'About Us', exact: true })).toBeVisible()
    await expect(english.getByRole('link', { name: 'Contact on X', exact: true })).toHaveAttribute('href', 'https://x.com/jece9925')
    await expect(english.locator('[data-platform="qq"]')).toHaveCount(0)
    for (const width of [375, 390, 430, 768, 1023, 1024, 1440]) {
      await english.setViewportSize({ width, height: 900 })
      await english.getByRole('button', { name: 'Choose language', exact: true }).click()
      const options = english.locator('#language-options')
      await expect(options).toBeVisible()
      const box = await options.boundingBox()
      expect(box!.x).toBeGreaterThanOrEqual(0)
      expect(box!.x + box!.width).toBeLessThanOrEqual(width)
      if (width === 1440) {
        const aboutMenu = await english.locator('.public-header__subnav-panel').boundingBox()
        expect(box!.width).toBeCloseTo(aboutMenu!.width, 0)
        const fontSize = await english.locator('.public-header__subnav-link').first().evaluate(el => getComputedStyle(el).fontSize)
        expect(await options.getByRole('button').first().evaluate(el => getComputedStyle(el).fontSize)).toBe(fontSize)
      }
      if (width === 390 || width === 1440) {
        mkdirSync('agent_docs/需求7-公开站中英切换/artifacts/screenshots', { recursive: true })
        await english.screenshot({ path: `agent_docs/需求7-公开站中英切换/artifacts/screenshots/language-menu-${width}.png` })
      }
      await english.keyboard.press('Escape')
      await expect(options).toHaveCount(0)
      expect(await english.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    }
    await english.getByRole('button', { name: 'Choose language', exact: true }).click()
    await english.getByRole('button', { name: '中文', exact: false }).click()
    await expect(english.locator('html')).toHaveAttribute('lang', 'zh-CN')
    expect(new URL(english.url()).hash).toBe('#contact')
    await english.reload()
    await expect(english.getByRole('heading', { name: '关于我们', exact: true })).toBeVisible()
    await english.getByRole('button', { name: '选择语言', exact: true }).click()
    await english.getByRole('button', { name: 'English', exact: false }).click()
    await english.goto(`${publicBaseURL}/commission/apply`)
    await expect(english.getByRole('heading', { name: 'Commission enquiries' })).toBeVisible()
    await expect(english.locator('form')).toHaveCount(0)
    await expect(english.getByRole('link', { name: 'Contact on X' })).toBeVisible()
    await english.getByRole('button', { name: 'Choose language', exact: true }).click()
    await english.getByRole('button', { name: '中文', exact: false }).click()
    await english.locator('#commission-nickname').fill('语言切换测试')
    await english.locator('input[type="file"]').setInputFiles({ name: 'reference.png', mimeType: 'image/png', buffer: smallStudioPng() })
    await english.getByRole('button', { name: '选择语言', exact: true }).click()
    await english.getByRole('button', { name: 'English', exact: false }).click()
    await expect(english.locator('form')).toHaveCount(0)
    await english.getByRole('button', { name: 'Choose language', exact: true }).click()
    await english.getByRole('button', { name: '中文', exact: false }).click()
    await expect(english.locator('#commission-nickname')).toHaveValue('语言切换测试')
    await expect(english.getByAltText('所选设定图预览')).toBeVisible()
    await english.locator('#commission-species').fill('犬科')
    await english.locator('#commission-phone').fill('13800000987')
    await english.locator('#commission-qq').fill('12345678')
    await english.locator('#commission-height').fill('170')
    await english.locator('#commission-weight').fill('65')
    await english.getByLabel(/已年满 18 周岁/u).check()
    await english.getByLabel(/已阅读《隐私政策》/u).check()
    let releaseUpload: (() => void) | undefined
    const uploadGate = new Promise<void>((resolve) => { releaseUpload = resolve })
    await english.route('**/api/public/v1/commission-upload-sessions', async (route) => {
      await uploadGate
      await route.abort()
    })
    await english.getByRole('button', { name: '确认提交', exact: true }).click()
    await english.getByRole('button', { name: '选择语言', exact: true }).click()
    await expect(english.getByRole('button', { name: 'English', exact: false })).toBeDisabled()
    await expect(english.getByText('请等待当前上传或提交完成后再切换语言。')).toBeVisible()
    releaseUpload!()
    await expect(english.getByRole('button', { name: 'English', exact: false })).toBeEnabled()
    await english.keyboard.press('Escape')
    await english.getByRole('button', { name: '选择语言', exact: true }).click()
    await english.getByRole('button', { name: 'English', exact: false }).click()
    await english.goto(`${publicBaseURL}/works/e2e-public-r7-language-character`)
    await expect(english.getByRole('heading', { name: '小狗', exact: true })).toBeVisible()
    await expect(english.getByText('犬科', { exact: true })).toBeVisible()
    await expect(english.locator('[data-testid="adoption-detail-price"]')).toHaveCount(0)
    for (const endpoint of ['adoptions', 'works/e2e-public-r7-language-character', 'home-aggregate']) {
      const data = await (await english.request.get(`${publicBaseURL}/api/public/v1/${endpoint}`)).json()
      expect(JSON.stringify(data)).not.toMatch(/"(?:price|minorUnits|priceCnyMinor)"/)
    }
    await english.goto(`${publicBaseURL}/`)
    await expect(english.locator('h1')).toHaveText('DITE DOG')
    for (const width of [390, 1440]) {
      await english.setViewportSize({ width, height: 900 })
      await expect(english.locator('.home-hero__tagline')).toBeVisible()
      await english.screenshot({ path: `agent_docs/需求7-公开站中英切换/artifacts/screenshots/english-hero-${width}.png` })
      expect(await english.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    }
    for (const [url, heading] of [['/commission', 'Commissions'], ['/privacy', 'Privacy Policy'], ['/licenses', 'Open Source Notices']]) {
      await english.goto(`${publicBaseURL}${url}`)
      await expect(english.getByRole('heading', { name: heading!, exact: true, level: 1 })).toBeVisible()
      if (url === '/privacy') await expect(english.getByText('Original document in Chinese')).toBeVisible()
    }
    await english.goto(`${publicBaseURL}/missing-r7-page`)
    await expect(english.getByRole('heading', { name: 'Page not found', exact: true })).toBeVisible()
    await expect(english.locator('html')).toHaveAttribute('lang', 'en')
    await english.goto(`${adminBaseURL}/admin/login`)
    await expect(english.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(english.locator('#language-options')).toHaveCount(0)
    expect(errors).toEqual([])
  }
  finally { await context.close() }
})


test('language hover and touch toggles, English commission title stays inside its column', async ({ page, browser }) => {
  test.setTimeout(120_000)
  await seedHeroCollections(page, { placement: 'commission', landscape: [{ alt: '委托横图', sortOrder: 0, enabled: true }], portrait: [{ alt: '委托竖图', sortOrder: 0, enabled: true }] })
  const desktop = await browser.newContext({ locale: 'en-US', viewport: { width: 1440, height: 900 } })
  const touch = await browser.newContext({ locale: 'en-US', viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true })
  try {
    const pc = await desktop.newPage()
    await pc.goto(`${publicBaseURL}/commission`)
    const trigger = pc.getByRole('button', { name: 'Choose language', exact: true })
    await expect(trigger).toBeEnabled()
    const about = pc.getByRole('button', { name: 'About Us', exact: true })
    await about.hover()
    const aboutPanel = pc.locator('.public-header__subnav-panel')
    const aboutTriggerBox = (await about.boundingBox())!
    await expect.poll(async () => Math.round((await aboutPanel.boundingBox())!.y - aboutTriggerBox.y - aboutTriggerBox.height)).toBe(8)
    const aboutTop = (await aboutPanel.boundingBox())!.y
    await trigger.hover()
    const menu = pc.locator('#language-options')
    await expect(menu).toBeVisible()
    const menuBox = (await menu.boundingBox())!
    expect(menuBox.y).toBeCloseTo(aboutTop, 0)
    const triggerBox = (await trigger.boundingBox())!
    await pc.mouse.move(triggerBox.x + triggerBox.width / 2, triggerBox.y + triggerBox.height + 4)
    await expect(menu).toBeVisible()
    await menu.getByRole('button', { name: '中文', exact: true }).hover()
    await expect(menu).toBeVisible()
    await pc.mouse.move(5, 200)
    await expect(menu).toHaveCount(0)
    await trigger.focus()
    await pc.keyboard.press('Enter')
    await expect(menu).toBeVisible()
    await pc.keyboard.press('Escape')
    await expect(menu).toHaveCount(0)
    await expect(trigger).toBeFocused()
    for (const width of [390, 768, 1024, 1280, 1440, 1920]) {
      await pc.setViewportSize({ width, height: 900 })
      await pc.evaluate(async () => { await document.fonts.ready })
      const title = await pc.locator('.commission-lead__title').boundingBox()
      const column = await pc.locator('.commission-lead__identity').boundingBox()
      expect(title!.x + title!.width).toBeLessThanOrEqual(column!.x + column!.width + 1)
      expect(await pc.locator('.commission-lead__title').evaluate(el => el.scrollWidth <= el.clientWidth + 1)).toBeTruthy()
      if (width >= 1024) {
        const media = await pc.locator('.commission-lead__media').boundingBox()
        expect(title!.x + title!.width).toBeLessThan(media!.x)
      }
      expect(await pc.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      if (width === 1440 || width === 390) await pc.screenshot({ path: `agent_docs/需求7-公开站中英切换/artifacts/screenshots/commission-english-${width}.png` })
    }
    const mobile = await touch.newPage()
    await mobile.goto(`${publicBaseURL}/commission`)
    const touchTrigger = mobile.getByRole('button', { name: 'Choose language', exact: true })
    await touchTrigger.tap()
    await expect(mobile.locator('#language-options')).toBeVisible()
    await touchTrigger.tap()
    await expect(mobile.locator('#language-options')).toHaveCount(0)
    await touchTrigger.tap()
    await mobile.locator('#language-options').getByRole('button', { name: '中文', exact: true }).tap()
    await expect(mobile.locator('html')).toHaveAttribute('lang', 'zh-CN')
    await expect(mobile.locator('#language-options')).toHaveCount(0)
  }
  finally { await desktop.close(); await touch.close() }
})
