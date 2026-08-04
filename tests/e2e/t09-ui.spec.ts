import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import { seedHomeSlides, seedPublicCatalog } from './helpers/public-catalog'
import type { SeedWork } from './helpers/public-catalog'

/** T09 公开页用例的种子目录：真实已发布投影，经控制面落库。 */
const T09_WORKS: SeedWork[] = [
  {
    slug: 'e2e-public-t09-naigai',
    characterName: '奶盖',
    species: '布偶猫',
    suitType: 'full',
    purpose: 'showcase',
    featured: true,
    sortOrder: 0,
    photos: [
      { alt: '奶盖的出厂照一' },
      { alt: '奶盖的出厂照二' },
      { alt: '奶盖的出厂照三' },
      { alt: '奶盖的出厂照四' },
    ],
  },
  {
    slug: 'e2e-public-t09-lanmei',
    characterName: '蓝湄',
    species: '北极狐',
    suitType: 'full',
    purpose: 'adoption',
    adoptionMethod: 'event_drop',
    businessStatus: 'available',
    priceMinorUnits: 1_560_000,
    featured: true,
    sortOrder: 1,
    photos: [{ alt: '蓝湄的出厂照' }],
  },
  {
    slug: 'e2e-public-t09-zhima',
    characterName: '芝麻',
    species: '哈士奇',
    suitType: 'full',
    purpose: 'commission',
    ownerDisplay: '阿灰',
    featured: true,
    sortOrder: 2,
    photos: [{ alt: '芝麻的出厂照' }],
  },
  {
    slug: 'e2e-public-t09-doudou',
    characterName: '豆豆',
    species: '柴犬',
    suitType: 'partial',
    purpose: 'commission',
    featured: true,
    sortOrder: 3,
    photos: [{ alt: '豆豆的出厂照' }],
  },
  {
    slug: 'e2e-public-t09-lizi',
    characterName: '栗子',
    species: '小熊',
    suitType: 'partial',
    purpose: 'showcase',
    featured: true,
    sortOrder: 4,
    photos: [{ alt: '栗子的出厂照' }],
  },
]

function seedT09Catalog(page: import('@playwright/test').Page) {
  return seedPublicCatalog(page, T09_WORKS)
}

/** 首页轮播种子：两张启用项，第二张关联蓝湄。 */
function seedT09Home(page: import('@playwright/test').Page) {
  return seedHomeSlides(page, [
    {
      alt: '奶盖的首页展示照',
      sortOrder: 0,
      enabled: true,
      linkedWorkSlug: 'e2e-public-t09-naigai',
    },
    {
      alt: '蓝湄的首页展示照',
      sortOrder: 1,
      enabled: true,
      linkedWorkSlug: 'e2e-public-t09-lanmei',
    },
  ])
}

/**
 * T09 界面修补回归（UI-01 至 UI-07，见 implementation/notes/T09-UI-2026-07-30.md）：
 * - UI-01 管理端独立布局：单一 main landmark、无公开 Header/Footer、后台 skip link
 * - UI-02 首页 Hero 确定性对比度：真实样张与最不利纯白底图双测量，不再用 /works 替代首页
 * - UI-03 动态参数：详情→详情、后台 id→id 同组件实例切换（T14–T18 起改为真实接口数据）
 * - UI-04 dirty 覆盖全部可编辑字段（含短属性 join('') 冲突用例）
 * - UI-06 reduced-motion 轨道即时滚动
 * - UI-07 登录页无占位文案
 *
 * 2026-08-01：管理端作品编辑已接入 T14–T18 真实接口，夹具版本用例（含 UI-05 金额校验）
 * 随夹具删除；CNY 价格输入将随 T22/T25 领养字段回归。
 */

test.describe('UI-01 管理端布局边界', () => {
  test('作品列表：单一 main、无公开 Header/Footer、后台 skip link 焦点顺序正确', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto(`${adminBaseURL}/admin/works`)
    await page.waitForSelector('.admin-shell')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByTestId('public-header')).toHaveCount(0)
    await expect(page.getByTestId('public-footer')).toHaveCount(0)

    // 首个 Tab 焦点为后台 skip link，目标为 AdminShell 的唯一 main
    await page.keyboard.press('Tab')
    const skip = page.getByRole('link', { name: '跳到主要内容' })
    await expect(skip).toBeFocused()
    await expect(skip).toHaveAttribute('href', '#admin-main')
    await expect(page.locator('main#admin-main')).toHaveCount(1)

    // 随后进入管理导航，再进入主内容之前的动作区
    await page.keyboard.press('Tab')
    await expect(
      page.getByRole('navigation', { name: '管理导航' }).getByRole('link', { name: '大图管理' }),
    ).toBeFocused()

    // 激活 skip link 后焦点落入主内容
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#admin-main')).toBeFocused()
  })

  test('作品编辑：单一 main、无公开 Header/Footer', async ({ page }) => {
    await loginAsAdmin(page)
    const work = await createWorkViaApi(page)
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByTestId('public-header')).toHaveCount(0)
    await expect(page.getByTestId('public-footer')).toHaveCount(0)
  })

  test('登录页保持独立呈现：单一 main、无公开 Header/Footer', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.waitForSelector('[data-testid="admin-login"]')

    await expect(page.locator('main')).toHaveCount(1)
    await expect(page.getByTestId('public-header')).toHaveCount(0)
    await expect(page.getByTestId('public-footer')).toHaveCount(0)
  })
})

test.describe('UI-02 首页 Hero 确定性对比度', () => {
  interface ContrastTarget {
    selector: string
    label: string
    /** 大字号文本（≥24px 或 18.66px 粗体）适用 3:1，其余 4.5:1。 */
    largeText?: boolean
  }

  const HERO_TARGETS: ContrastTarget[] = [
    { selector: '.public-header__brand', label: '头部品牌' },
    { selector: '.home-hero__eyebrow', label: '英文眉标' },
    { selector: '.home-hero__title', label: '主标题', largeText: true },
    { selector: '.home-hero__tagline', label: '口号' },
    { selector: '.home-hero__action', label: '主行动' },
  ]

  // 仅桌面可见的目标（移动视口下桌面导航隐藏，改测菜单按钮）。
  const DESKTOP_ONLY_TARGETS: ContrastTarget[] = [
    { selector: '.public-header__nav a[href="/works"]', label: '导航链接' },
  ]

  /**
   * 对元素截图并估算文字背后合成背景（图片 + scrim）的相对亮度：
   * 反白文字是区域内最亮像素，取最暗 40% 像素的均值作为背景估计，
   * 再与纯白文字求 WCAG 对比度。该方法对任意图片成立，不依赖某张夹具恰好较暗。
   */
  async function measureContrast(
    page: import('@playwright/test').Page,
    selector: string,
  ): Promise<number> {
    const locator = page.locator(selector).first()
    const box = await locator.boundingBox()
    if (!box) {
      throw new Error(`无法测量，元素不可见：${selector}`)
    }
    const shot = await page.screenshot({ clip: box })
    const base64 = shot.toString('base64')
    const backdropLuminance = await page.evaluate(async (data) => {
      const image = new Image()
      image.src = `data:image/png;base64,${data}`
      await image.decode()
      const canvas = document.createElement('canvas')
      canvas.width = image.naturalWidth
      canvas.height = image.naturalHeight
      const context = canvas.getContext('2d')!
      context.drawImage(image, 0, 0)
      const { data: pixels } = context.getImageData(0, 0, canvas.width, canvas.height)
      const luminances: number[] = []
      for (let index = 0; index < pixels.length; index += 4) {
        const channel = (value: number) => {
          const srgb = value / 255
          return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4
        }
        luminances.push(
          0.2126 * channel(pixels[index]!)
          + 0.7152 * channel(pixels[index + 1]!)
          + 0.0722 * channel(pixels[index + 2]!),
        )
      }
      luminances.sort((a, b) => a - b)
      const darkCount = Math.max(1, Math.floor(luminances.length * 0.4))
      return luminances.slice(0, darkCount).reduce((sum, value) => sum + value, 0) / darkCount
    }, base64)
    return (1 + 0.05) / (backdropLuminance + 0.05)
  }

  async function expectHeroContrast(
    page: import('@playwright/test').Page,
    context: string,
    extraTargets: ContrastTarget[] = [],
  ) {
    for (const target of [...HERO_TARGETS, ...extraTargets]) {
      const ratio = await measureContrast(page, target.selector)
      const threshold = target.largeText ? 3 : 4.5
      expect(
        ratio,
        `${context}：${target.label} 对比度 ${ratio.toFixed(2)} 应 ≥ ${threshold}`,
      ).toBeGreaterThanOrEqual(threshold)
    }
  }

  test('真实轮播图：桌面与手机视口的导航、口号与行动附近均满足 AA', async ({ page }) => {
    await seedT09Catalog(page)
    await seedT09Home(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expectHeroContrast(page, '1440×900 真实轮播', DESKTOP_ONLY_TARGETS)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expectHeroContrast(page, '390×844 真实轮播')
    // 手机菜单按钮为图形控件，按非文本 3:1 验收
    const menuRatio = await measureContrast(page, '.public-header__menu')
    expect(menuRatio, `手机菜单按钮对比度 ${menuRatio.toFixed(2)}`).toBeGreaterThanOrEqual(3)
  })

  test('最不利纯白底图：替换首项轮播图片后白字仍满足 AA', async ({ page }) => {
    await seedT09Catalog(page)
    await seedT09Home(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    // <picture> 的 <source> srcset 优先于 img.src，必须先移除 source 再替换。
    await page.locator('.home-hero__slide picture').evaluate((picture: HTMLPictureElement) => {
      for (const source of Array.from(picture.querySelectorAll('source'))) {
        source.remove()
      }
      const image = picture.querySelector('img')!
      image.removeAttribute('srcset')
      image.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="%23ffffff"/></svg>'
    })
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('.home-hero__slide img')
      return image?.complete && image.naturalWidth > 0
    })
    await page.waitForTimeout(150)

    await expectHeroContrast(page, '1440×900 纯白底图')
  })
})

test.describe('UI-03 动态参数响应', () => {
  test('详情→详情：内容、图集、价格、SEO 与 related works 全部更新', async ({ page }) => {
    await seedT09Catalog(page)
    await page.goto('/works/e2e-public-t09-naigai')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'e2e-public-t09-naigai')
    await expect(page.getByRole('button', { name: /查看第 \d 张，共 4 张/ })).toHaveCount(4)
    await expect(page.getByTestId('work-price')).toHaveCount(0)

    const target = page.locator('.work-detail__related-grid a[href="/works/e2e-public-t09-lanmei"]')
    await expect(target).toBeVisible()
    await target.click()

    await expect(page).toHaveURL(/\/works\/e2e-public-t09-lanmei$/)
    await expect(page).toHaveTitle(/蓝湄 · 作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '蓝湄' })).toBeVisible()
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'e2e-public-t09-lanmei')
    // 奶盖无价格、蓝湄有 CNY 价格：价格区随作品切换出现
    await expect(page.getByTestId('work-price')).toBeVisible()
    await expect(page.getByText('¥15,600')).toBeVisible()
    // 蓝湄为单图作品：缩略图行整体消失
    await expect(page.getByRole('button', { name: /查看第 \d 张，共 \d 张/ })).toHaveCount(0)
    // related works 不再包含当前作品自身
    await expect(page.locator('.work-detail__related-grid a[href="/works/e2e-public-t09-lanmei"]')).toHaveCount(0)
    // SEO 元信息同步更新
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /蓝湄/)

    // 再从 related works 进入芝麻（委托、无价格）：价格区随之消失
    await page.locator('.work-detail__related-grid a[href="/works/e2e-public-t09-zhima"]').click()
    await expect(page).toHaveURL(/\/works\/e2e-public-t09-zhima$/)
    await expect(page).toHaveTitle(/芝麻 · 作品展示/)
    await expect(page.getByRole('heading', { level: 1, name: '芝麻' })).toBeVisible()
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'e2e-public-t09-zhima')
    await expect(page.getByTestId('work-price')).toHaveCount(0)
    await expect(page.locator('.work-detail__related-grid a[href="/works/e2e-public-t09-zhima"]')).toHaveCount(0)
  })

  test('详情→不存在 slug 进入 404 错误页，再进有效 slug 完整恢复', async ({ page }) => {
    await seedT09Catalog(page)
    await page.goto('/works/e2e-public-t09-lanmei')
    await page.waitForLoadState('networkidle')

    // 通过应用内 router 制造同组件实例参数切换（不经整页刷新）
    const push = (to: string) => page.evaluate((path) => {
      const root = document.querySelector('#__nuxt') as HTMLElement & {
        __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => void } } } }
      }
      root.__vue_app__.config.globalProperties.$router.push(path)
    }, to)

    await push('/works/not-exist')
    await expect(page).toHaveTitle(/404 · 页面未找到/)
    await expect(page.getByRole('heading', { level: 1, name: '页面未找到' })).toBeVisible()

    await push('/works/e2e-public-t09-naigai')
    await expect(page).toHaveTitle(/奶盖 · 作品展示/)
    await expect(page.getByRole('heading', { level: 1, name: '奶盖' })).toBeVisible()
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'e2e-public-t09-naigai')
  })

  test('后台编辑 id→id：表单重建、dirty 基线重置（真实接口数据）', async ({ page }) => {
    await loginAsAdmin(page)
    const first = await createWorkViaApi(page, { characterName: '切换甲' })
    const second = await createWorkViaApi(page, { characterName: '切换乙' })

    await page.goto(`${adminBaseURL}/admin/works/${first.id}`)
    await page.waitForSelector('.editor-card')
    await expect(page.getByLabel(/角色名/)).toHaveValue('切换甲')

    // 弄脏当前表单，验证切换后不会残留
    await page.getByLabel(/角色名/).fill('切换甲改')
    await expect(page.getByText('有未保存更改')).toBeVisible()

    // CSR 页面经 popstate 制造同组件实例 ID 切换
    const switchTo = (id: string) => page.evaluate((target) => {
      history.pushState({}, '', `/admin/works/${target}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, id)

    await switchTo(second.id)
    await expect(page).toHaveURL(new RegExp(`/admin/works/${second.id}$`))
    await expect(page.getByRole('heading', { level: 1, name: '切换乙' })).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveValue('切换乙')
    // dirty 基线随作品重建：上一个作品的未保存输入不残留
    await expect(page.getByText('未更改')).toBeVisible()
    await expect(page.getByText('有未保存更改')).toHaveCount(0)

    // id→不存在：进入缺失分支而非崩溃
    await switchTo('00000000-0000-4000-8000-000000000000')
    await expect(page.getByText('未找到该作品')).toBeVisible()

    // 不存在→有效 id：表单按新作品重建
    await switchTo(first.id)
    await expect(page.getByRole('heading', { level: 1, name: '切换甲' })).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveValue('切换甲')
    await expect(page.getByText('未更改')).toBeVisible()
  })
})

test.describe('UI-04 dirty 覆盖全部可编辑字段', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  const dirtyBadge = (page: import('@playwright/test').Page) => page.getByText('有未保存更改')

  test('基础字段修改与还原均影响 dirty', async ({ page }) => {
    const work = await createWorkViaApi(page, {
      characterName: '脏值验证',
      ownerContact: null,
    })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel(/角色名/).fill('脏值验证改')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel(/角色名/).fill('脏值验证')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('装型').selectOption('partial')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('装型').selectOption('full')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('用途').selectOption('showcase')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('用途').selectOption('commission')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('角色主人公开值').fill('有点小狗工作室')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('角色主人公开值').fill('不公开')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('人工排序').fill('3')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('人工排序').fill('0')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('加入首页精选作品').check()
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('加入首页精选作品').uncheck()
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel(/联系人/).fill('新联系方式')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel(/联系人/).fill('')
    await expect(dirtyBadge(page)).toHaveCount(0)
  })

  test('短属性：join(‘’) 冲突、增删与内容修改均影响 dirty', async ({ page }) => {
    const work = await createWorkViaApi(page, {
      featureTags: ['纯海绵头', '内置风扇'],
    })
    await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
    await page.waitForSelector('.editor-card')

    // join('') 冲突用例：['纯海绵头','内置风扇'] → ['纯海绵头内','置风扇']
    // 拼接结果不变但归属不同，必须判 dirty（旧 join 比较会漏判）。
    const first = page.getByLabel('作品属性第 1 条')
    const second = page.getByLabel('作品属性第 2 条')
    await first.fill('纯海绵头内')
    await second.fill('置风扇')
    await expect(dirtyBadge(page)).toBeVisible()
    await first.fill('纯海绵头')
    await second.fill('内置风扇')
    await expect(dirtyBadge(page)).toHaveCount(0)

    // 增删：新增一条（含空值）即 dirty；删除新增的空条目后回到基线
    await page.getByRole('button', { name: '添加属性' }).click()
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('作品属性第 3 条').fill('新属性')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByRole('button', { name: '删除第 3 条属性' }).click()
    await expect(dirtyBadge(page)).toHaveCount(0)
  })
})

test.describe('UI-06 reduced-motion 轨道', () => {
  async function recordScrollBehaviors(page: import('@playwright/test').Page) {
    await page.addInitScript(() => {
      const recorded: string[] = []
      ;(window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors = recorded
      const original = Element.prototype.scrollBy
      const patched = function (this: Element, ...args: unknown[]) {
        const first = args[0]
        recorded.push(
          typeof first === 'object' && first !== null && 'behavior' in first
            ? String((first as ScrollToOptions).behavior)
            : 'auto',
        )
        return (original as (...inner: unknown[]) => void).apply(this, args)
      }
      Element.prototype.scrollBy = patched as typeof Element.prototype.scrollBy
    })
  }

  const readBehaviors = (page: import('@playwright/test').Page) =>
    page.evaluate(() => (window as unknown as { __scrollBehaviors: string[] }).__scrollBehaviors)

  test('reduce 偏好下按钮与键盘路径使用即时滚动', async ({ page }) => {
    await recordScrollBehaviors(page)
    const session = await page.context().newCDPSession(page)
    await session.send('Emulation.setEmulatedMedia', {
      features: [{ name: 'prefers-reduced-motion', value: 'reduce' }],
    })

    await seedT09Catalog(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const track = page.getByTestId('featured-track')
    const next = track.getByRole('button', { name: '下一批作品' })

    await expect(async () => {
      await next.click()
      expect(await readBehaviors(page)).toContain('auto')
    }).toPass({ timeout: 20_000 })

    const behaviors = await readBehaviors(page)
    expect(behaviors.length).toBeGreaterThan(0)
    expect(behaviors.every(behavior => behavior === 'auto')).toBe(true)
  })

  test('正常动效偏好保持 smooth 滚动', async ({ page }) => {
    await recordScrollBehaviors(page)
    await seedT09Catalog(page)
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const next = page.getByTestId('featured-track').getByRole('button', { name: '下一批作品' })

    await expect(async () => {
      await next.click()
      expect(await readBehaviors(page)).toContain('smooth')
    }).toPass({ timeout: 20_000 })
  })
})

test.describe('UI-07 登录页无占位文案', () => {
  test('登录页已接入真实认证，不再保留占位文案', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.waitForSelector('[data-testid="admin-login"]')
    await expect(page.getByText(/尚未接入/)).toHaveCount(0)
    await expect(page.getByText(/视觉样张/)).toHaveCount(0)
    await expect(page.getByText(/T07|T13/)).toHaveCount(0)
  })
})
