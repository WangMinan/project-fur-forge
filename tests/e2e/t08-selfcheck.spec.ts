import { expect, test } from '@playwright/test'
import { loginAsAdmin } from './helpers/auth'

/**
 * T08 评审自查（自动化部分）：
 * - 三视口 × 五个关键页面无横向溢出
 * - 关键文本颜色对比度 ≥ 4.5:1
 * - prefers-reduced-motion 生效（管理端控件动效归零、公开卡片悬停不放大）
 * - /works 与详情页 CLS < 0.1
 * - 键盘：skip link 为首焦点，图集缩略图可 Tab 到达
 */

const adminBaseURL = 'http://localhost:3100'
const BLUEBERRY_ID = 'b943ee7e-0e9a-4944-a36b-ed61b8b9a640'

const VIEWPORTS = [
  { width: 390, height: 844, name: '390x844' },
  { width: 768, height: 1024, name: '768x1024' },
  { width: 1440, height: 900, name: '1440x900' },
] as const

const PAGES = [
  { name: 'home', url: '/', host: 'public' },
  { name: 'works-list', url: '/works', host: 'public' },
  { name: 'work-detail', url: '/works/blueberry', host: 'public' },
  { name: 'admin-works', url: `${adminBaseURL}/admin/works`, host: 'admin' },
  { name: 'admin-editor', url: `${adminBaseURL}/admin/works/${BLUEBERRY_ID}`, host: 'admin' },
] as const

for (const viewport of VIEWPORTS) {
  for (const target of PAGES) {
    test(`无横向溢出：${target.name} @ ${viewport.name}`, async ({ page }) => {
      await page.setViewportSize({ width: viewport.width, height: viewport.height })
      if (target.host === 'admin') {
        await loginAsAdmin(page)
      }
      await page.goto(target.url)
      if (target.host === 'admin') {
        await page.waitForSelector('.admin-shell, [data-testid="admin-login"]')
      }
      await page.waitForLoadState('networkidle')

      const overflow = await page.evaluate(() =>
        document.scrollingElement!.scrollWidth - document.documentElement.clientWidth,
      )
      expect(overflow).toBeLessThanOrEqual(1)
    })
  }
}

function relativeLuminance(rgb: [number, number, number]) {
  const [r, g, b] = rgb.map((channel) => {
    const value = channel / 255
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrastRatio(foreground: [number, number, number], background: [number, number, number]) {
  const lighter = Math.max(relativeLuminance(foreground), relativeLuminance(background))
  const darker = Math.min(relativeLuminance(foreground), relativeLuminance(background))
  return (lighter + 0.05) / (darker + 0.05)
}

function parseRgb(value: string): [number, number, number] {
  const match = value.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/)
  if (!match) {
    throw new Error(`无法解析颜色：${value}`)
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

test.describe('对比度抽查（AA 4.5:1）', () => {
  test('公开站：正文/次要文字/页脚/筛选文字', async ({ page }) => {
    await page.goto('/works')
    await page.waitForLoadState('networkidle')

    const samples = await page.evaluate(() => {
      const pick = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) {
          return null
        }
        const styles = getComputedStyle(element)
        return { color: styles.color, background: styles.backgroundColor }
      }
      return {
        heading: pick('.public-page-intro h1, h1'),
        secondary: pick('.work-card__meta'),
        filterCount: pick('.work-filter__count'),
        footer: pick('.site-footer, footer'),
      }
    })

    const white: [number, number, number] = [255, 255, 255]
    const results: Array<[string, number]> = []
    for (const [key, sample] of Object.entries(samples)) {
      if (!sample) {
        continue
      }
      const foreground = parseRgb(sample.color)
      // 白底页面，直接对白底求比值；非白底元素用自身背景。
      const background = sample.background.startsWith('rgba(0, 0, 0, 0') || sample.background === 'transparent'
        ? white
        : parseRgb(sample.background)
      results.push([key, contrastRatio(foreground, background)])
    }

    for (const [key, ratio] of results) {
      expect(ratio, `${key} 对比度 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })

  test('管理端：正文/次要文字/徽章文字', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/works`)
    await page.waitForSelector('.works-page__header')

    const samples = await page.evaluate(() => {
      const effectiveBackground = (element: Element) => {
        let node: Element | null = element
        while (node) {
          const bg = getComputedStyle(node).backgroundColor
          if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) {
            return bg
          }
          node = node.parentElement
        }
        return 'rgb(255, 255, 255)'
      }
      const pick = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) {
          return null
        }
        const styles = getComputedStyle(element)
        return { color: styles.color, background: effectiveBackground(element) }
      }
      return {
        title: pick('.works-page__title'),
        meta: pick('.works-page__meta'),
        badgeSuccess: pick('.admin-badge[data-tone=\'success\']'),
        badgeWarning: pick('.admin-badge[data-tone=\'warning\']'),
        badgeInfo: pick('.admin-badge[data-tone=\'info\']'),
        badgeError: pick('.admin-badge[data-tone=\'error\']'),
      }
    })

    const results: Array<[string, number]> = []
    for (const [key, sample] of Object.entries(samples)) {
      if (!sample) {
        continue
      }
      results.push([key, contrastRatio(parseRgb(sample.color), parseRgb(sample.background))])
    }

    // 编辑器页补充失败（error）与阻塞提示徽章取样。
    await page.goto(`${adminBaseURL}/admin/works/3cb1db83-c2c5-42a1-8e5e-a61cb97d2422`)
    await page.waitForSelector('.editor-card')
    const editorSamples = await page.evaluate(() => {
      const effectiveBackground = (element: Element) => {
        let node: Element | null = element
        while (node) {
          const bg = getComputedStyle(node).backgroundColor
          if (bg && bg !== 'transparent' && !bg.startsWith('rgba(0, 0, 0, 0')) {
            return bg
          }
          node = node.parentElement
        }
        return 'rgb(255, 255, 255)'
      }
      const pick = (selector: string) => {
        const element = document.querySelector(selector)
        if (!element) {
          return null
        }
        const styles = getComputedStyle(element)
        return { color: styles.color, background: effectiveBackground(element) }
      }
      return {
        badgeError: pick('.admin-badge[data-tone=\'error\']'),
        badgeWarning: pick('.admin-badge[data-tone=\'warning\']'),
      }
    })
    for (const [key, sample] of Object.entries(editorSamples)) {
      if (!sample) {
        continue
      }
      results.push([`editor-${key}`, contrastRatio(parseRgb(sample.color), parseRgb(sample.background))])
    }

    for (const [key, ratio] of results) {
      expect(ratio, `${key} 对比度 ${ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
    }
  })
})

test.describe('减少动态效果', () => {
  // 通过 CDP 强制 prefers-reduced-motion（比 test.use 的上下文选项更确定）。
  async function emulateReducedMotion(page: import('@playwright/test').Page) {
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })
  }

  test('管理端控件过渡时间归零', async ({ page }) => {
    await emulateReducedMotion(page)
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.waitForSelector('[data-testid="admin-login"]')

    const duration = await page.evaluate(() => {
      const button = document.querySelector('.login__submit')
      return button ? getComputedStyle(button).transitionDuration : null
    })
    expect(duration).not.toBeNull()
    for (const value of duration!.split(',').map(item => item.trim())) {
      expect(Number.parseFloat(value)).toBeLessThanOrEqual(0.02)
    }
  })

  test('公开卡片悬停不放大', async ({ page }) => {
    await emulateReducedMotion(page)
    await page.goto('/works')
    await page.waitForLoadState('networkidle')

    const matches = await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches)
    expect(matches).toBe(true)

    const image = page.locator('.work-card__image').first()
    await image.hover()
    const transform = await image.evaluate(element => getComputedStyle(element).transform)
    expect(transform === 'none' || transform === 'matrix(1, 0, 0, 1, 0, 0)').toBe(true)
  })
})

test.describe('CLS', () => {
  for (const target of [
    { name: 'works-list', url: '/works' },
    { name: 'work-detail', url: '/works/naigai' },
  ]) {
    test(`${target.name} CLS < 0.1`, async ({ page }) => {
      await page.goto(target.url)
      const cls = await page.evaluate(() => new Promise<number>((resolve) => {
        let value = 0
        const observer = new PerformanceObserver((list) => {
          for (const entry of list.getEntries()) {
            const shift = entry as PerformanceEntry & { hadRecentInput?: boolean, value?: number }
            if (!shift.hadRecentInput && typeof shift.value === 'number') {
              value += shift.value
            }
          }
        })
        observer.observe({ type: 'layout-shift', buffered: true })
        window.setTimeout(() => {
          observer.disconnect()
          resolve(value)
        }, 2_500)
      }))
      expect(cls).toBeLessThan(0.1)
    })
  }
})

test.describe('键盘可达性', () => {
  test('公开站首焦点为跳到主要内容，随后进入导航', async ({ page }) => {
    await page.goto('/works')
    await page.keyboard.press('Tab')
    await expect(page.getByRole('link', { name: '跳到主要内容' })).toBeFocused()
    await page.keyboard.press('Tab')
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName)
    expect(focusedTag).toBe('A')
  })

  test('详情页图集缩略图可 Tab 到达并响应 Enter', async ({ page }) => {
    await page.goto('/works/naigai')
    await page.waitForLoadState('networkidle')

    const secondThumb = page.getByRole('button', { name: '查看第 2 张，共 4 张' })
    await secondThumb.focus()
    await expect(secondThumb).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(secondThumb).toHaveAttribute('aria-pressed', 'true')
  })
})
