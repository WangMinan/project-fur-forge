import { expect, test, type Locator } from '@playwright/test'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'

async function swipe(stage: Locator, direction: 'next' | 'prev') {
  await stage.dispatchEvent('pointerdown', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: 200, clientY: 200 })
  await stage.dispatchEvent('pointerup', { pointerId: 1, pointerType: 'touch', isPrimary: true, clientX: direction === 'next' ? 80 : 320, clientY: 220 })
}

async function inspectCrossfade(stage: Locator, direction: 'next' | 'prev', trigger: () => Promise<void>) {
  // Vue's enter-active class precedes transitionrun; capture before triggering, even on a busy runner.
  const capture = await stage.evaluateHandle(root => {
    const freeze = (event: Event) => {
      if (!(event.target instanceof Element) || !event.target.matches('.work-gallery__image')) return
      for (const animation of event.target.getAnimations()) {
        animation.pause()
        animation.currentTime = Number(animation.effect!.getTiming().duration) / 4
      }
    }
    root.addEventListener('transitionrun', freeze)
    return () => root.removeEventListener('transitionrun', freeze)
  })
  try {
    await trigger()
    await expect(stage.locator(`.public-media-${direction}-enter-active`)).toHaveCount(1)
    await expect.poll(() => stage.locator('.work-gallery__image').evaluateAll(images => (
      images.flatMap(image => image.getAnimations()).filter(animation => animation.playState === 'paused').length
    ))).toBe(4)
    const layers = await stage.evaluate(root => [...root.querySelectorAll('.work-gallery__image')].map(image => {
      const style = getComputedStyle(image)
      return { entering: image.className.includes('enter-active'), opacity: Number(style.opacity), x: new DOMMatrix(style.transform).m41 }
    }))
    expect(layers).toHaveLength(2)
    for (const layer of layers) {
      expect(layer.opacity).toBeGreaterThan(0)
      expect(layer.opacity).toBeLessThan(1)
      const sign = direction === 'next' ? 1 : -1
      expect(layer.x * (layer.entering ? sign : -sign)).toBeGreaterThan(0)
    }
    await stage.screenshot({ path: test.info().outputPath(`crossfade-${direction}.png`), animations: 'allow' })
  }
  finally {
    await capture.evaluate(remove => remove())
    await capture.dispose()
    await stage.evaluate(root => root.getAnimations({ subtree: true }).forEach(animation => animation.play()))
  }
  await expect(stage.locator('.work-gallery__image')).toHaveCount(1)
}

for (const width of [402, 1440]) {
  test(`作品详情在 ${width}px 复用首页交叉淡化并支持中断与减少动态`, async ({ page }) => {
    await seedPublicCatalog(page, [{
      slug: 'e2e-public-gallery-motion', characterName: '图库动效', photos: [
        { alt: '第一张', width: 2400, height: 3200 },
        { alt: '第二张', width: 3200, height: 2400 },
        { alt: '第三张', width: 2400, height: 2400 },
      ],
    }])
    await page.setViewportSize({ width, height: 800 })
    await page.emulateMedia({ reducedMotion: 'no-preference' })
    const errors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    await page.goto('/works/e2e-public-gallery-motion')
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    await page.waitForFunction(() => Boolean((document.querySelector('.work-gallery') as Element & { __vueParentComponent?: { isMounted: boolean } })?.__vueParentComponent?.isMounted))
    const stage = page.locator('.work-gallery__stage')
    const thumbs = page.locator('.work-gallery__thumb')
    await stage.scrollIntoViewIfNeeded()
    await stage.locator('img').evaluate((image: HTMLImageElement) => image.decode())

    await inspectCrossfade(stage, 'next', () => swipe(stage, 'next'))
    await expect(thumbs.nth(1)).toHaveAttribute('aria-pressed', 'true')
    await inspectCrossfade(stage, 'prev', () => swipe(stage, 'prev'))
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    // Wrapping must follow the gesture, not the numerical difference between indices.
    await inspectCrossfade(stage, 'prev', () => swipe(stage, 'prev'))
    await expect(thumbs.last()).toHaveAttribute('aria-pressed', 'true')
    await inspectCrossfade(stage, 'next', () => swipe(stage, 'next'))
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')

    await inspectCrossfade(stage, 'next', () => thumbs.last().press('Enter'))
    await thumbs.first().click()
    await thumbs.nth(1).click()
    await expect(stage.locator('.work-gallery__image')).toHaveCount(1)
    await expect(stage.locator('img')).toHaveAttribute('alt', '第二张')
    await expect(stage.locator('.work-gallery__image')).toHaveCSS('opacity', '1')
    await expect(stage.locator('.work-gallery__image')).toHaveCSS('transform', 'none')

    await page.emulateMedia({ reducedMotion: 'reduce' })
    await swipe(stage, 'next')
    await expect(thumbs.last()).toHaveAttribute('aria-pressed', 'true')
    await expect(stage.locator('.work-gallery__image')).toHaveCount(1)
    expect(await stage.evaluate(root => root.getAnimations({ subtree: true }).length)).toBe(0)
    await expect(stage.locator('.work-gallery__image')).toHaveCSS('opacity', '1')
    expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBeLessThanOrEqual(1)
    expect(errors).toEqual([])
  })
}
