import { expect, test } from '@playwright/test'

/**
 * T09 界面修补回归（UI-01 至 UI-07，见 implementation/notes/T09-UI-HANDOFF.md）：
 * - UI-01 管理端独立布局：单一 main landmark、无公开 Header/Footer、后台 skip link
 * - UI-02 首页 Hero 确定性对比度：真实样张与最不利纯白底图双测量，不再用 /works 替代首页
 * - UI-03 动态参数：详情→详情、后台 id→id 同组件实例切换
 * - UI-04 dirty 覆盖全部可编辑字段（含短属性 join('') 冲突用例）
 * - UI-05 金额严格校验与服务端接受集合一致，非法输入发布同步阻断
 * - UI-06 reduced-motion 轨道即时滚动
 * - UI-07 真实任务阶段文案
 */

const adminBaseURL = 'http://localhost:3100'
const BLUEBERRY_ID = 'b943ee7e-0e9a-4944-a36b-ed61b8b9a640'
const LIZI_ID = '3cb1db83-c2c5-42a1-8e5e-a61cb97d2422'

test.describe('UI-01 管理端布局边界', () => {
  test('作品列表：单一 main、无公开 Header/Footer、后台 skip link 焦点顺序正确', async ({ page }) => {
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
      page.getByRole('navigation', { name: '管理导航' }).getByRole('link', { name: '作品' }),
    ).toBeFocused()

    // 激活 skip link 后焦点落入主内容
    await skip.focus()
    await page.keyboard.press('Enter')
    await expect(page.locator('main#admin-main')).toBeFocused()
  })

  test('作品编辑：单一 main、无公开 Header/Footer', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
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
    { selector: '.hero-media__eyebrow', label: '英文眉标' },
    { selector: '.hero-media__title', label: '主标题', largeText: true },
    { selector: '.hero-media__tagline', label: '口号' },
    { selector: '.hero-media__action', label: '主行动' },
  ]

  // 仅桌面可见的目标（移动视口下桌面导航与滚动提示隐藏，改测菜单按钮）。
  const DESKTOP_ONLY_TARGETS: ContrastTarget[] = [
    { selector: '.public-header__nav a[href="/works"]', label: '导航链接' },
    { selector: '.hero-media__scroll-hint', label: '向下浏览提示' },
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

  test('真实样张：桌面与手机视口的导航、口号与行动附近均满足 AA', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expectHeroContrast(page, '1440×900 真实样张', DESKTOP_ONLY_TARGETS)

    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')
    await expectHeroContrast(page, '390×844 真实样张')
    // 手机菜单按钮为图形控件，按非文本 3:1 验收
    const menuRatio = await measureContrast(page, '.public-header__menu')
    expect(menuRatio, `手机菜单按钮对比度 ${menuRatio.toFixed(2)}`).toBeGreaterThanOrEqual(3)
  })

  test('最不利纯白底图：替换 Hero 图片后白字仍满足 AA', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    await page.waitForLoadState('networkidle')

    await page.locator('.hero-media__image').evaluate((image: HTMLImageElement) => {
      image.src = 'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="1920" height="1080"><rect width="1920" height="1080" fill="%23ffffff"/></svg>'
    })
    await page.waitForFunction(() => {
      const image = document.querySelector<HTMLImageElement>('.hero-media__image')
      return image?.complete && image.naturalWidth > 0
    })
    await page.waitForTimeout(150)

    await expectHeroContrast(page, '1440×900 纯白底图')
  })
})

test.describe('UI-03 动态参数响应', () => {
  test('详情→详情：内容、图集、价格、SEO 与 related works 全部更新', async ({ page }) => {
    await page.goto('/works/naigai')
    await page.waitForLoadState('networkidle')
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'naigai')
    await expect(page.getByRole('button', { name: /查看第 \d 张，共 4 张/ })).toHaveCount(4)
    await expect(page.getByTestId('work-price')).toHaveCount(0)

    const target = page.locator('.work-detail__related-grid a[href="/works/blueberry"]')
    await expect(target).toBeVisible()
    await target.click()

    await expect(page).toHaveURL(/\/works\/blueberry$/)
    await expect(page).toHaveTitle(/蓝莓 · 作品展示 · 有点小狗工作室/)
    await expect(page.getByRole('heading', { level: 1, name: '蓝莓' })).toBeVisible()
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'blueberry')
    // 奶盖无价格、蓝莓有 CNY 价格：价格区随作品切换出现
    await expect(page.getByTestId('work-price')).toBeVisible()
    await expect(page.getByText('¥15,600')).toBeVisible()
    // 蓝莓为单图作品：缩略图行整体消失
    await expect(page.getByRole('button', { name: /查看第 \d 张，共 \d 张/ })).toHaveCount(0)
    // related works 不再包含当前作品自身
    await expect(page.locator('.work-detail__related-grid a[href="/works/blueberry"]')).toHaveCount(0)
    // SEO 元信息同步更新
    await expect(page.locator('meta[property="og:title"]')).toHaveAttribute('content', /蓝莓/)

    // 再从 related works 进入芝麻（委托、无价格）：价格区随之消失
    await page.locator('.work-detail__related-grid a[href="/works/zhima"]').click()
    await expect(page).toHaveURL(/\/works\/zhima$/)
    await expect(page).toHaveTitle(/芝麻 · 作品展示/)
    await expect(page.getByRole('heading', { level: 1, name: '芝麻' })).toBeVisible()
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'zhima')
    await expect(page.getByTestId('work-price')).toHaveCount(0)
    await expect(page.locator('.work-detail__related-grid a[href="/works/zhima"]')).toHaveCount(0)
  })

  test('详情→不存在 slug 进入 404 错误页，再进有效 slug 完整恢复', async ({ page }) => {
    await page.goto('/works/blueberry')
    await page.waitForLoadState('networkidle')

    // dev 下通过应用内 router 制造同组件实例参数切换（不经整页刷新）
    const push = (to: string) => page.evaluate((path) => {
      const root = document.querySelector('#__nuxt') as HTMLElement & {
        __vue_app__: { config: { globalProperties: { $router: { push: (to: string) => void } } } }
      }
      root.__vue_app__.config.globalProperties.$router.push(path)
    }, to)

    await push('/works/not-exist')
    await expect(page).toHaveTitle(/404 · 页面未找到/)
    await expect(page.getByRole('heading', { level: 1, name: '页面未找到' })).toBeVisible()

    await push('/works/naigai')
    await expect(page).toHaveTitle(/奶盖 · 作品展示/)
    await expect(page.getByRole('heading', { level: 1, name: '奶盖' })).toBeVisible()
    await expect(page.getByTestId('work-detail')).toHaveAttribute('data-work-slug', 'naigai')
  })

  test('后台编辑 id→id：表单重建、dirty 基线重置、发布检查随作品更新', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
    await page.waitForSelector('.editor-card')
    await expect(page.getByLabel(/公开人民币价格/)).toHaveValue('15600')

    // 弄脏当前表单，验证切换后不会残留
    await page.getByLabel(/角色名/).fill('蓝莓改')
    await expect(page.getByText('有未保存更改')).toBeVisible()

    // CSR 页面经 popstate 制造同组件实例 ID 切换
    const switchTo = (id: string) => page.evaluate((target) => {
      history.pushState({}, '', `/admin/works/${target}`)
      window.dispatchEvent(new PopStateEvent('popstate'))
    }, id)

    await switchTo(LIZI_ID)
    await expect(page).toHaveURL(new RegExp(`/admin/works/${LIZI_ID}$`))
    await expect(page.getByRole('heading', { level: 1, name: '栗子' })).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveValue('栗子')
    // dirty 基线随作品重建：上一个作品的未保存输入不残留
    await expect(page.getByText('未更改')).toBeVisible()
    await expect(page.getByText('有未保存更改')).toHaveCount(0)
    // 栗子为展示作品：领养字段隐藏；失败素材继续阻断发布
    await expect(page.getByLabel('领养方式')).toHaveCount(0)
    await expect(page.getByText('暂不可发布')).toBeVisible()
    await expect(page.getByRole('button', { name: '发布', exact: true })).toBeDisabled()

    // id→不存在：进入缺失分支而非崩溃
    await switchTo('00000000-0000-4000-8000-000000000000')
    await expect(page.getByText('未找到该作品')).toBeVisible()

    // 不存在→有效 id：表单按新作品重建
    await switchTo(BLUEBERRY_ID)
    await expect(page.getByRole('heading', { level: 1, name: '蓝莓' })).toBeVisible()
    await expect(page.getByLabel(/角色名/)).toHaveValue('蓝莓')
    await expect(page.getByLabel(/公开人民币价格/)).toHaveValue('15600')
    await expect(page.getByText('未更改')).toBeVisible()
  })
})

test.describe('UI-04 dirty 覆盖全部可编辑字段', () => {
  const dirtyBadge = (page: import('@playwright/test').Page) => page.getByText('有未保存更改')

  test('领养方式、业务状态与价格修改均影响 dirty', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
    await page.waitForSelector('.editor-card')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('领养方式').selectOption('regular')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('领养方式').selectOption('event_drop')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel('业务状态').selectOption('scheduled')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel('业务状态').selectOption('available')
    await expect(dirtyBadge(page)).toHaveCount(0)

    await page.getByLabel(/公开人民币价格/).fill('16800')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByLabel(/公开人民币价格/).fill('15600')
    await expect(dirtyBadge(page)).toHaveCount(0)
  })

  test('短属性：join(‘’) 冲突、增删与内容修改均影响 dirty', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
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
    await page.getByLabel('作品属性第 5 条').fill('新属性')
    await expect(dirtyBadge(page)).toBeVisible()
    await page.getByRole('button', { name: '删除第 5 条属性' }).click()
    await expect(dirtyBadge(page)).toHaveCount(0)
  })

  test('用途切换：隐藏的领养字段不产生隐藏脏值，切回后原值保留', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
    await page.waitForSelector('.editor-card')

    // 蓝莓 → 委托：领养字段隐藏，dirty 仅来自用途本身
    await page.getByLabel('用途').selectOption('commission')
    await expect(page.getByLabel('领养方式')).toHaveCount(0)
    await expect(dirtyBadge(page)).toBeVisible()

    // 切回领养：隐藏期间保留的值等于基线，不形成隐藏脏值
    await page.getByLabel('用途').selectOption('adoption')
    await expect(page.getByLabel('领养方式')).toHaveValue('event_drop')
    await expect(page.getByLabel('业务状态')).toHaveValue('available')
    await expect(page.getByLabel(/公开人民币价格/)).toHaveValue('15600')
    await expect(dirtyBadge(page)).toHaveCount(0)
  })
})

test.describe('UI-05 金额严格校验', () => {
  test('非法集合：字段错误、程序化关联与发布同步阻断；合法与留空恢复', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${BLUEBERRY_ID}`)
    await page.waitForSelector('.editor-card')
    const price = page.getByLabel(/公开人民币价格/)
    const publish = page.getByRole('button', { name: '发布', exact: true })
    await expect(publish).toBeEnabled()

    // 零、负值、指数、尾随字符、两位以上小数：全部拒绝且阻断发布
    for (const bad of ['0', '-1', '1e4', '12abc', '1.234']) {
      await price.fill(bad)
      await expect(page.locator('#f-price-error')).toBeVisible()
      await expect(price).toHaveAttribute('aria-invalid', 'true')
      await expect(price).toHaveAttribute('aria-describedby', /f-price-error/)
      await expect(page.getByText('价格未通过校验')).toBeVisible()
      await expect(publish).toBeDisabled()
      await expect(page.getByText('暂不可发布')).toBeVisible()
    }

    // 合法两位小数：错误清除，发布检查恢复
    await price.fill('8800.50')
    await expect(page.locator('#f-price-error')).toHaveCount(0)
    await expect(price).not.toHaveAttribute('aria-invalid', 'true')
    await expect(page.getByText('¥8,800.50 将展示在公开端')).toBeVisible()
    await expect(publish).toBeEnabled()

    // 留空 = 不公开价格：无错误、可发布
    await price.fill('')
    await expect(page.locator('#f-price-error')).toHaveCount(0)
    await expect(page.getByText('未录入价格，公开端整区隐藏')).toBeVisible()
    await expect(publish).toBeEnabled()
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
    await page.setViewportSize({ width: 1440, height: 900 })
    await page.goto('/')
    const next = page.getByTestId('featured-track').getByRole('button', { name: '下一批作品' })

    await expect(async () => {
      await next.click()
      expect(await readBehaviors(page)).toContain('smooth')
    }).toPass({ timeout: 20_000 })
  })
})

test.describe('UI-07 真实任务阶段文案', () => {
  test('编辑页引用真实任务编号：T14–T15 上传、T16 衍生图与失败重试、T17 保存、T18 发布', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/works/${LIZI_ID}`)
    await page.waitForSelector('.editor-card')

    await expect(page.getByText(/公开端实际衍生图由 OSS 生成（T16）/)).toBeVisible()
    await expect(page.getByText(/T11–T12/)).toHaveCount(0)

    // 栗子含“校验”环节失败素材：重试指向 T15
    await page.getByRole('button', { name: '重试' }).click()
    await expect(page.getByRole('status').last()).toContainText('重试接口尚未接入（T15）')

    await page.getByRole('button', { name: '上传出厂照' }).click()
    await expect(page.getByRole('status').last()).toContainText('上传接口尚未接入（T14–T15）')

    await page.getByRole('button', { name: '保存草稿' }).click()
    await expect(page.getByRole('status').last()).toContainText('保存接口尚未接入（T17）')
  })

  test('登录页不再引用过期任务编号', async ({ page }) => {
    await page.goto(`${adminBaseURL}/admin/login`)
    await page.waitForSelector('[data-testid="admin-login"]')
    await expect(page.getByText(/认证能力尚未接入（T13）/)).toBeVisible()
    await expect(page.getByText(/T07 视觉样张/)).toHaveCount(0)
  })
})
