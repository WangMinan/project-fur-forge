import { expect, test, type Locator, type Page } from '@playwright/test'
import type { PublicAdoptionListDto } from '../../shared/types/contracts'
import { publicBaseURL } from '../e2e/helpers/auth'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'

const works = [[2400, 1667], [2400, 4800], [2400, 2400]].map(([width, height], index) => ({
  slug: `e2e-public-containment-${index}` as const,
  characterName: `完整设定${index}`,
  purpose: 'adoption' as const,
  adoptionStatus: 'available' as const,
  designSheet: { alt: `设定图${index}`, width, height },
  photos: [],
}))
const viewports = [[320, 568], [402, 680], [390, 844], [667, 375], [767, 600], [768, 1024], [1024, 768], [1025, 600], [1440, 900]]

async function seedImages(page: Page, count: number) {
  await seedPublicCatalog(page, works.slice(0, count))
  const response = await page.request.get(`${publicBaseURL}/api/public/v1/adoptions`)
  expect(response.ok()).toBe(true)
  const { data } = await response.json() as { data: PublicAdoptionListDto }
  expect(data.items).toHaveLength(count)
  // The generic media fake has fixed pixels; use real intrinsic dimensions for layout checks.
  for (const item of data.items) {
    for (const source of [...item.cover.sources.webp, ...item.cover.sources.fallback]) {
      await page.route(source.src, route => route.fulfill({
        contentType: 'image/svg+xml',
        body: `<svg xmlns="http://www.w3.org/2000/svg" width="${source.width}" height="${source.height}" viewBox="0 0 100 100" preserveAspectRatio="none"><rect width="100" height="100" fill="#e8edf5"/><path d="M0 0H100V100H0Z" fill="none" stroke="#324aad" stroke-width="4"/><path d="M4 92H96V96H4Z" fill="#df5a36"/></svg>`,
      }))
    }
  }
}

async function expectContainedImage(frame: Locator) {
  await frame.evaluate(async root => {
    await Promise.all(root.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => {})))
  })
  const image = frame.locator('img').last()
  await image.evaluate((el: HTMLImageElement) => el.decode())
  await expect(image).toHaveCSS('object-fit', 'contain')
  // Check the image against every enclosing box: object-fit alone cannot detect parent clipping.
  await expect.poll(() => frame.evaluate(root => {
    const img = root.querySelector('img')!
    const imageBox = img.getBoundingClientRect()
    const overflow: string[] = []
    for (let parent = img.parentElement; parent && root.contains(parent); parent = parent.parentElement) {
      const box = parent.getBoundingClientRect()
      const style = getComputedStyle(parent)
      if (imageBox.left < box.left + parseFloat(style.borderLeftWidth) + parseFloat(style.paddingLeft) - 1
        || imageBox.right > box.right - parseFloat(style.borderRightWidth) - parseFloat(style.paddingRight) + 1
        || imageBox.top < box.top + parseFloat(style.borderTopWidth) + parseFloat(style.paddingTop) - 1
        || imageBox.bottom > box.bottom - parseFloat(style.borderBottomWidth) - parseFloat(style.paddingBottom) + 1) {
        overflow.push(`${parent.className}: image ${imageBox.width}x${imageBox.height}, frame ${box.width}x${box.height}`)
      }
    }
    return overflow
  })).toEqual([])
}

for (const count of [1, 3]) {
  test(`首页领养 ${count} 张图片在长短屏和横竖屏均完整显示`, async ({ page }) => {
    test.setTimeout(180_000)
    await seedImages(page, count)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.goto(`${publicBaseURL}/`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const frame = page.getByTestId('home-adoption-media-link')
    for (const [width, height] of viewports) {
      await page.setViewportSize({ width: width!, height: height! })
      for (const work of works.slice(0, count)) {
        if (count > 1) {
          await page.locator(`.home-adoption-poster__selector-item[data-work-slug="${work.slug}"]`).click()
          await expect(page.locator('.home-adoption-poster')).toHaveAttribute('data-work-slug', work.slug)
          await expect(frame.locator('img')).toHaveCount(1)
        }
        await frame.scrollIntoViewIfNeeded()
        await expectContainedImage(frame)
        expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
      }
    }
    await page.setViewportSize({ width: 402, height: 680 })
    await frame.scrollIntoViewIfNeeded()
    await frame.screenshot({ path: test.info().outputPath(`home-adoption-${count}-mobile.png`) })
    // Keep the same geometry after normal entrance/switch animations and hover settle.
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    await page.reload()
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    await frame.scrollIntoViewIfNeeded()
    if (count > 1) await page.locator('.home-adoption-poster__selector-item').last().click()
    await expect(frame.locator('img')).toHaveCount(1)
    await frame.hover()
    await expectContainedImage(frame)
  })
}

test('领养目录和详情的横图竖图方图均完整显示', async ({ page }) => {
  test.setTimeout(180_000)
  await seedImages(page, works.length)
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.goto(`${publicBaseURL}/adoptions`)
  await expect(page.locator('.adoption-card__canvas')).toHaveCount(works.length)
  for (const [width, height] of viewports) {
    await page.setViewportSize({ width: width!, height: height! })
    for (const frame of await page.locator('.adoption-card__canvas').all()) {
      await frame.scrollIntoViewIfNeeded()
      await expectContainedImage(frame)
    }
  }
  for (const work of works) {
    await page.goto(`${publicBaseURL}/works/${work.slug}?from=adoptions`)
    for (const [width, height] of [[402, 680], [667, 375], [1440, 900]]) {
      await page.setViewportSize({ width: width!, height: height! })
      await expectContainedImage(page.locator('.work-gallery__stage'))
    }
  }
})
