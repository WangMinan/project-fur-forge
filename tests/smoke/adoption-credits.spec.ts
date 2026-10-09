import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { adminBaseURL, publicBaseURL } from '../e2e/helpers/auth'
import { createWorkViaApi } from '../e2e/helpers/admin-work'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'

const evidence = 'agent_docs/需求13-领养价格与画师展示/artifacts/screenshots'

test('adoption credits: placement, SSR, language, responsive layout and touch navigation', async ({ page, browser }) => {
  test.setTimeout(180_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' || /hydration/i.test(message.text())) errors.push(message.text()) })
  const cases = [
    { slug: 'both', artist: '测试画师', priceCnyMinor: 880050 },
    { slug: 'artist', artist: 'LongArtistCreditWithoutSpaces'.repeat(3) },
    { slug: 'price', priceCnyMinor: 1 },
    { slug: 'neither' },
    { slug: 'adopted', artist: '测试画师', priceCnyMinor: 880050, adopted: true },
  ]
  await seedPublicCatalog(page, cases.map(item => ({
    slug: `e2e-public-r13-${item.slug}`,
    characterName: item.slug === 'artist' ? '长角色名称需要保持完整可读'.repeat(3) : `角色 ${item.slug}`,
    species: '鸟龙', purpose: 'adoption', adoptionStatus: item.adopted ? 'adopted' : 'available',
    artist: item.artist, priceCnyMinor: item.priceCnyMinor,
    photos: [{ alt: '测试出厂照' }], adoptionCover: { alt: '测试设定图' },
  })))
  mkdirSync(evidence, { recursive: true })
  for (const language of ['zh-CN', 'en']) {
    await page.context().addCookies([{ name: 'site-language', value: language, url: publicBaseURL }])
    for (const item of cases) {
      const path = `/works/e2e-public-r13-${item.slug}`
      await page.goto(`${publicBaseURL}${path}`)
      await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
      await expect(page.locator('html')).toHaveAttribute('lang', language)
      await expect(page.getByTestId('adoption-detail-artist')).toHaveCount(item.artist ? 1 : 0)
      await expect(page.getByTestId('adoption-detail-price')).toHaveCount(item.priceCnyMinor ? 1 : 0)
      if (item.artist) {
        await expect(page.getByTestId('adoption-detail-artist')).toHaveText(item.artist)
        await expect(page.locator('.work-detail__identity-ledger > div').first().locator('dt')).toHaveText(language === 'en' ? 'Artist' : '画师')
      }
      if (item.priceCnyMinor) await expect(page.getByTestId('adoption-detail-price')).toHaveText(`${language === 'en' ? 'CNY ' : '¥'}${item.priceCnyMinor === 1 ? '0.01' : '8,800.50'}`)
      if (item.adopted) await expect(page.getByTestId('adoption-contact-action')).toBeDisabled()
      const ssr = await (await page.request.get(`${publicBaseURL}${path}`)).text()
      expect(ssr.includes('data-testid="adoption-detail-price"')).toBe(Boolean(item.priceCnyMinor))
      expect(ssr.includes('data-testid="adoption-detail-artist"')).toBe(Boolean(item.artist))
    }
    await page.goto(`${publicBaseURL}/adoptions`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const card = page.locator('[data-work-slug="e2e-public-r13-both"]')
    await expect(card.locator('.adoption-card__artist')).toHaveText(language === 'en' ? 'Artist: 测试画师' : '画师：测试画师')
    await expect(page.locator('[data-work-slug="e2e-public-r13-neither"] .adoption-card__artist')).toHaveCount(0)
    await expect(page.locator('#main-content')).not.toContainText(/8,800|CNY|¥/)
    for (const width of [320, 390, 768, 1024, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await expect(card).toBeVisible()
      await card.scrollIntoViewIfNeeded()
      await card.locator('img').evaluate(image => (image as HTMLImageElement).decode())
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect(await page.locator('.adoption-card__profile').evaluateAll(elements => elements.flatMap(profile => {
        const bounds = profile.getBoundingClientRect()
        return Array.from(profile.querySelectorAll('.adoption-card__title, .adoption-card__facts, .adoption-card__artist, .adoption-card__action'))
          .filter(el => {
            const box = el.getBoundingClientRect()
            return el.scrollWidth > el.clientWidth + 1 || box.left < bounds.left - 1 || box.right > bounds.right + 1
          }).map(el => el.className)
      }))).toEqual([])
      if (width === 390 || width === 1440) {
        await card.screenshot({ animations: 'disabled', path: `${evidence}/card-${language}-${width}.png` })
        await page.locator('[data-work-slug="e2e-public-r13-artist"]').screenshot({ animations: 'disabled', path: `${evidence}/long-card-${language}-${width}.png` })
      }
    }
    await page.setViewportSize({ width: 390, height: 1000 })
    await page.evaluate(() => { document.documentElement.style.fontSize = '200%' })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await page.evaluate(() => { document.documentElement.style.fontSize = '' })
    await card.focus()
    await expect(card).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(page).toHaveURL(/\/works\/e2e-public-r13-both\?from=adoptions$/)
    await expect(page.getByTestId('adoption-detail-price')).toBeVisible()
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 1000 })
      await page.evaluate(async () => { await document.fonts.ready })
      await page.screenshot({ animations: 'disabled', path: `${evidence}/detail-${language}-${width}.png`, fullPage: true })
    }
    for (const path of ['/', '/works']) {
      await page.goto(`${publicBaseURL}${path}`)
      await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
      await expect(page.locator('#main-content')).not.toContainText(/测试画师|LongArtistCredit|8,800|CNY|¥/)
    }
  }
  for (const endpoint of ['home-aggregate', 'works', 'adoptions']) {
    const data = await (await page.request.get(`${publicBaseURL}/api/public/v1/${endpoint}`)).json()
    expect(JSON.stringify(data)).not.toMatch(/"priceCnyMinor"/)
    if (endpoint !== 'adoptions') expect(JSON.stringify(data)).not.toMatch(/"artist"/)
  }
  const touch = await browser.newContext({ hasTouch: true, isMobile: true, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', locale: 'en-US' })
  try {
    const mobile = await touch.newPage()
    await mobile.goto(`${publicBaseURL}/adoptions`)
    await mobile.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    await mobile.locator('[data-work-slug="e2e-public-r13-both"]').tap()
    await expect(mobile.getByTestId('adoption-detail-price')).toHaveText('CNY 8,800.50')
    const imageBefore = await mobile.locator('.work-detail__media img').first().getAttribute('src')
    await mobile.getByRole('button', { name: 'Choose language', exact: true }).tap()
    await mobile.getByRole('button', { name: '中文' }).tap()
    await expect(mobile.getByTestId('adoption-detail-price')).toHaveText('¥8,800.50')
    expect(new URL(mobile.url()).search).toBe('?from=adoptions')
    expect(await mobile.locator('.work-detail__media img').first().getAttribute('src')).toBe(imageBefore)
  }
  finally { await touch.close() }
  expect(errors).toEqual([])
})

test('admin artist and price save, preview, reload and clear', async ({ page }) => {
  const work = await createWorkViaApi(page, { purpose: 'adoption', adoptionStatus: 'adopted', priceCnyMinor: 880050 })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
  await expect(page.locator('#f-artist')).toBeVisible()
  await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
  await page.locator('#f-artist').fill('测试画师')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.locator('#f-artist')).toHaveValue('测试画师')
  await expect(page.getByTestId('public-preview')).toContainText('测试画师')
  await expect(page.locator('#f-price')).toHaveValue('8800.50')
  mkdirSync(evidence, { recursive: true })
  for (const width of [390, 1440]) {
    await page.setViewportSize({ width, height: 1000 })
    await page.getByTestId('public-preview').screenshot({ animations: 'disabled', path: `${evidence}/admin-preview-${width}.png` })
  }
  await page.locator('#f-artist').fill('')
  await page.locator('#f-price').fill('')
  await page.getByRole('button', { name: '保存', exact: true }).click()
  await expect(page.getByRole('button', { name: '保存', exact: true })).toBeDisabled()
  await page.reload()
  await expect(page.locator('#f-artist')).toHaveValue('')
  await expect(page.locator('#f-price')).toHaveValue('')
})
