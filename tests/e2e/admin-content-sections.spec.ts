import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from './helpers/auth'
import {
  contactQrPng,
  fakeMediaState,
  lowResolutionContactQrPng,
  nonSquareContactQrPng,
  resetFakeMedia,
  resetOfficialChannels,
  setFakeMediaFlags,
} from './helpers/fake-media'
import { capture } from './helpers/screenshots'

const SCREENSHOT_DIR
  = 'agent_docs/需求1-兽装工作室主页/implementation/notes/t34-c1/screenshots'
const REQUIREMENT_2_SCREENSHOT_DIR
  = 'agent_docs/需求2-站点导航与内容增强/implementation/notes/t15/screenshots'

/**
 * T34-F3 文案分区 Card：独立保存、分区并发、分区级 409 与草稿保留。
 * 使用真实管理 Host 与真实点击，不直接改数据库。
 */
const CONTENT_PATH = '/admin/site/content'

async function openContentAdmin(page: import('@playwright/test').Page) {
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}${CONTENT_PATH}`)
  await expect(page.getByTestId('content-admin')).toBeVisible()
}

function card(page: import('@playwright/test').Page, section: string) {
  return page.locator(`[data-testid="site-section-card"][data-section="${section}"]`)
}

async function chooseQr(
  page: import('@playwright/test').Page,
  platform: string,
  fileName: string,
  content: Buffer,
) {
  const chooser = page.waitForEvent('filechooser')
  await card(page, 'contact').locator(`[data-platform="${platform}"]`)
    .getByRole('button', { name: /二维码/u }).click()
  await (await chooser).setFiles({
    name: `${fileName}.png`,
    mimeType: 'image/png',
    buffer: content,
  })
}

test('五个现存文案分区各自独立保存，互不禁用', async ({ page }) => {
  await openContentAdmin(page)

  const sections = [
    'commission',
    'about',
    'terms',
    'privacy',
    'contact',
  ]
  for (const section of sections) {
    await expect(card(page, section)).toBeVisible()
  }
  await expect(card(page, 'terms')).toContainText('直接面向访客；写清价格、权利、修改、保修和官方渠道')
  await expect(card(page, 'privacy')).toContainText('直接面向访客；只说明当前实际处理的信息、用途、保存期限和联系办法')

  const commission = card(page, 'commission')
  const about = card(page, 'about')

  // 初始都不脏，保存按钮禁用。
  await expect(commission.getByTestId('site-section-save')).toBeDisabled()

  await commission.locator('#site-field-intro').fill('委托简介：先聊角色设定。')
  await expect(commission.getByTestId('site-section-dirty')).toBeVisible()
  // 一个 Card 变脏不影响其它 Card。
  await expect(about).toHaveAttribute('data-dirty', 'false')
  await expect(about.getByTestId('site-section-save')).toBeDisabled()

  await commission.getByTestId('site-section-save').click()
  await expect(commission.getByTestId('site-section-saved')).toBeVisible()
  await expect(commission).toHaveAttribute('data-dirty', 'false')

  // 另一个分区随后独立保存也成功。
  await about.locator('#site-field-studioFacts').fill('工作室介绍：只做兽装。')
  await about.getByTestId('site-section-save').click()
  await expect(about.getByTestId('site-section-saved')).toBeVisible()

  // 重载后两个分区的内容都在，没有互相覆盖。
  await page.reload()
  await expect(card(page, 'commission').locator('#site-field-intro'))
    .toHaveValue('委托简介：先聊角色设定。')
  await expect(card(page, 'about').locator('#site-field-studioFacts'))
    .toHaveValue('工作室介绍：只做兽装。')
})

test('同一分区并发保存：第二个上下文得到分区级冲突且保留本地草稿', async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const pageA = await first.newPage()
  const pageB = await second.newPage()

  try {
    await openContentAdmin(pageA)
    await openContentAdmin(pageB)

    // 两个上下文都基于同一份 commission 分区基线。
    await card(pageA, 'commission').locator('#site-field-intro').fill('A 的委托简介')
    await card(pageB, 'commission').locator('#site-field-intro').fill('B 的委托简介')

    await card(pageA, 'commission').getByTestId('site-section-save').click()
    await expect(card(pageA, 'commission').getByTestId('site-section-saved'))
      .toBeVisible()

    // B 用陈旧版本保存同一分区：分区级冲突，不是整页报错。
    await card(pageB, 'commission').getByTestId('site-section-save').click()
    const conflictB = card(pageB, 'commission')
    await expect(conflictB.getByTestId('site-section-conflict')).toBeVisible()
    await expect(conflictB).toHaveAttribute('data-conflict', 'true')
    // 本地草稿仍然保留，没有被服务端值直接顶掉。
    await expect(conflictB.locator('#site-field-intro')).toHaveValue('B 的委托简介')
    // 冲突面板展示服务端最新内容供对比。
    await expect(conflictB.getByTestId('site-section-conflict'))
      .toContainText('A 的委托简介')
    // 其它分区不受影响，仍可正常保存。
    await expect(card(pageB, 'about')).toHaveAttribute('data-conflict', 'false')
    await expect(card(pageB, 'about').getByTestId('site-section-save'))
      .toBeDisabled()

    // 采用最新内容后草稿被替换，冲突可以重新保存。
    await conflictB.getByTestId('site-section-adopt-latest').click()
    await expect(conflictB.locator('#site-field-intro')).toHaveValue('A 的委托简介')

    await capture(pageB, 't34-f3-section-conflict', SCREENSHOT_DIR)
  }
  finally {
    await first.close()
    await second.close()
  }
})

test('官方渠道 Card：邮箱、QQ、QQ群和防诈骗提醒一次保存并投影到公开页', async ({ page }) => {
  await openContentAdmin(page)
  const channels = card(page, 'contact')

  // 四个字段都在同一张 Card 里可编辑，共用一次局部保存。
  await expect(channels.locator('#site-field-email')).toBeEditable()
  await expect(channels.locator('#site-field-qq')).toBeEditable()
  await expect(channels.locator('#site-field-qq_group')).toBeEditable()
  await expect(channels.locator('#site-field-antiScam')).toBeEditable()

  await channels.locator('#site-field-email').fill('channels@example.test')
  await channels.locator('#site-field-qq').fill('123456789')
  await channels.locator('#site-field-qq_group').fill('456789012')
  await channels.locator('#site-field-antiScam')
    .fill('只认这些官方渠道，其他都是冒充。')
  await channels.getByTestId('site-section-save').click()
  await expect(channels.getByTestId('site-section-saved')).toBeVisible()

  // 无效邮箱与 QQ 在保存前就被拦下，不会发出请求。
  await channels.locator('#site-field-email').fill('invalid')
  await expect(channels.getByTestId('site-section-save')).toBeDisabled()
  await channels.locator('#site-field-email').fill('channels@example.test')
  await channels.locator('#site-field-qq').fill('0123')
  await expect(channels.getByTestId('site-section-save')).toBeDisabled()
  await channels.getByRole('button', { name: '放弃修改' }).click()

  await page.reload()
  const reloaded = card(page, 'contact')
  await expect(reloaded.locator('#site-field-email'))
    .toHaveValue('channels@example.test')
  await expect(reloaded.locator('#site-field-qq')).toHaveValue('123456789')

  // 公开页联系人跟随官方渠道 Card。
  await page.goto(`${publicBaseURL}/about#contact`)
  const contact = page.getByTestId('about-contact')
  await expect(
    contact.getByRole('link', { name: /打开邮件客户端/u }),
  ).toHaveAttribute('href', 'mailto:channels@example.test')
  const about = page.getByTestId('about-page')
  const antiScam = about.locator('.about-page__antiscam')
  await expect(antiScam).toContainText('只认这些官方渠道，其他都是冒充。')
  await expect(antiScam).toHaveCSS('background-color', 'rgba(0, 0, 0, 0)')
  await expect(antiScam).toHaveCSS('padding-top', '0px')
  const contactTitle = contact.getByRole('heading', { name: '联系', level: 2 })
  const antiScamTitle = antiScam.getByRole('heading', { name: '防诈骗提示', level: 2 })
  const titleStyles = await Promise.all([contactTitle, antiScamTitle].map(title => (
    title.evaluate((element) => {
      const style = getComputedStyle(element)
      return [style.fontFamily, style.fontSize, style.fontWeight, style.lineHeight]
    })
  )))
  expect(titleStyles[1]).toEqual(titleStyles[0])

  const scope = page.getByTestId('about-scope')
  const sectionGaps = await Promise.all([
    [scope, contact],
    [contact, antiScam],
  ].map(async ([before, after]) => {
    const beforeBox = await before!.boundingBox()
    const afterBox = await after!.boundingBox()
    expect(beforeBox).not.toBeNull()
    expect(afterBox).not.toBeNull()
    return afterBox!.y - (beforeBox!.y + beforeBox!.height)
  }))
  expect(Math.abs(sectionGaps[1]! - sectionGaps[0]!)).toBeLessThanOrEqual(1)
  // 账号没有 READY 二维码时不进入公开渠道列表。
  await expect(contact.getByText('123456789', { exact: true })).toHaveCount(0)
})

test('官方渠道二维码：固定两行、前置校验、失败重试、保存和预览恢复', async ({ page }) => {
  await resetFakeMedia(page)
  await openContentAdmin(page)
  const channels = card(page, 'contact')
  const rows = channels.locator('[data-platform]')
  await expect(rows).toHaveCount(2)
  expect(await rows.evaluateAll(elements => elements.map(
    element => element.getAttribute('data-platform'),
  ))).toEqual([
    'qq',
    'qq_group',
  ])

  const qq = channels.locator('[data-platform="qq"]')
  await expect(qq).toContainText('公开页暂不显示')

  // 非方形 PNG 也由 FFmpeg 完整容纳到方形画布，不要求管理员预处理。
  await chooseQr(page, 'qq', 'not-square', nonSquareContactQrPng())
  await expect(qq.getByText('新二维码已上传，保存联系方式后生效。')).toBeVisible()
  const nonSquareState = await fakeMediaState(page)
  expect(nonSquareState.objects.some(key => (
    key.includes('/contact-qr-upscale-lanczos-v1/')
  ))).toBe(true)
  expect(nonSquareState.putRecords).toHaveLength(1)

  // 低分辨率二维码会显示 FFmpeg 适配进度；失败保留私有原图并提供重试。
  await setFakeMediaFlags(page, { failProcess: true })
  await chooseQr(page, 'qq', 'qq-low-resolution', lowResolutionContactQrPng())
  await expect(qq.getByTestId('ffmpeg-progress')).toContainText('FFmpeg Lanczos')
  await expect(qq.getByRole('alert')).toContainText('二维码网页图片生成失败')
  const failedState = await fakeMediaState(page)
  expect(failedState.objects.some(key => (
    key.includes('/contact-qr-upscale-lanczos-v1/')
  ))).toBe(true)
  await expect(qq.getByRole('alert')).toContainText('二维码网页图片生成失败')
  await expect(qq.getByRole('button', { name: '重试处理' })).toBeVisible()

  await setFakeMediaFlags(page, { failProcess: false })
  await qq.getByRole('button', { name: '重试处理' }).click()
  await expect(qq.getByText('新二维码已上传，保存联系方式后生效。')).toBeVisible()
  await expect(qq.getByRole('img', { name: 'QQ二维码预览' })).toHaveAttribute('src', /^blob:/u)
  await expect(channels.getByTestId('site-section-dirty')).toBeVisible()

  await channels.locator('#site-field-qq').fill('123456789')
  await channels.getByTestId('site-section-save').click()
  await expect(channels.getByTestId('site-section-saved')).toBeVisible()

  await page.reload()
  const savedQq = card(page, 'contact').locator('[data-platform="qq"]')
  await expect(savedQq.getByRole('img', { name: 'QQ二维码预览' })).toHaveAttribute(
    'src',
    /\/api\/admin\/v1\/media\/assets\/[0-9a-f-]+\/preview\?w=320$/u,
  )
  await expect(savedQq).toContainText('信息完整，保存后可在公开页显示。')

  await page.goto(`${publicBaseURL}/about#contact`)
  const publicGrid = page.getByTestId('contact-channel-grid')
  const publicQq = publicGrid.locator('[data-platform="qq"]')
  await expect(publicGrid.getByTestId('contact-channel-card')).toHaveCount(1)
  await expect(publicQq.getByRole('heading', { name: 'QQ' })).toBeVisible()
  await expect(publicQq.getByText('123456789', { exact: true })).toBeVisible()
  await expect(publicQq.locator('.contact-channel-grid__logo'))
    .toHaveAttribute('src', '/contact-platforms/qq.svg')
  const publicQr = publicQq.getByRole('img', { name: '扫描QQ官方二维码' })
  await expect(publicQr).toHaveAttribute('srcset', /contact-qr-v1/u)
  await expect.poll(() => publicQr.evaluate(
    element => (element as HTMLImageElement).naturalWidth,
  )).toBeGreaterThan(0)
})

test('公开官方渠道：QQ 与QQ群按固定顺序显示 Logo、二维码和账号，三视口不溢出', async ({ page }) => {
  await resetFakeMedia(page)
  await openContentAdmin(page)

  const fixtures = [
    { platform: 'qq', label: 'QQ', account: '345678901', logo: 'qq.svg' },
    { platform: 'qq_group', label: 'QQ群', account: '456789012', logo: 'qq.svg' },
  ] as const

  const channels = card(page, 'contact')
  for (const fixture of fixtures) {
    const row = channels.locator(`[data-platform="${fixture.platform}"]`)
    await row.locator(`#site-field-${fixture.platform}`).fill(fixture.account)
    await chooseQr(page, fixture.platform, fixture.platform, contactQrPng())
    await expect(row.getByText('新二维码已上传，保存联系方式后生效。')).toBeVisible()
  }
  await channels.getByTestId('site-section-save').click()
  await expect(channels.getByTestId('site-section-saved')).toBeVisible()

  await page.goto(`${publicBaseURL}/about#contact`)
  const grid = page.getByTestId('contact-channel-grid')
  const cards = grid.getByTestId('contact-channel-card')
  await expect(cards).toHaveCount(fixtures.length)

  for (const fixture of fixtures) {
    const channel = grid.locator(`[data-platform="${fixture.platform}"]`)
    await expect(channel.getByRole('heading', { name: fixture.label })).toBeVisible()
    await expect(channel.getByText(fixture.account, { exact: true })).toBeVisible()
    await expect(channel.locator('.contact-channel-grid__logo'))
      .toHaveAttribute('src', `/contact-platforms/${fixture.logo}`)
    await expect.poll(() => channel.getByRole('img', {
      name: `扫描${fixture.label}官方二维码`,
    }).evaluate(element => (element as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
  }

  for (const viewport of [
    { width: 390, height: 844, firstRowCount: 2 },
    { width: 768, height: 1024, firstRowCount: 2 },
    { width: 1440, height: 900, firstRowCount: 2 },
  ]) {
    await page.setViewportSize(viewport)
    const cardTops = await cards.evaluateAll(elements => elements.map(
      element => Math.round(element.getBoundingClientRect().top),
    ))
    expect(cardTops.filter(top => top === cardTops[0])).toHaveLength(viewport.firstRowCount)
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
    await capture(
      page,
      `public-two-channels-${viewport.width}x${viewport.height}`,
      REQUIREMENT_2_SCREENSHOT_DIR,
    )
  }
})

test('公开官方渠道只有两个完整平台时保持卡片阅读宽度并左对齐', async ({ page }) => {
  await resetOfficialChannels(page)
  await resetFakeMedia(page)
  await openContentAdmin(page)
  const channels = card(page, 'contact')
  for (const fixture of [
    { platform: 'qq', account: '123456789' },
    { platform: 'qq_group', account: '456789012' },
  ] as const) {
    const row = channels.locator(`[data-platform="${fixture.platform}"]`)
    await row.locator(`#site-field-${fixture.platform}`).fill(fixture.account)
    await chooseQr(page, fixture.platform, fixture.platform, contactQrPng())
    await expect(row.getByText('新二维码已上传，保存联系方式后生效。')).toBeVisible()
  }
  await channels.getByTestId('site-section-save').click()
  await expect(channels.getByTestId('site-section-saved')).toBeVisible()

  await page.goto(`${publicBaseURL}/about#contact`)
  const grid = page.getByTestId('contact-channel-grid')
  const cards = grid.getByTestId('contact-channel-card')
  await expect(cards).toHaveCount(2)
  for (const viewport of [
    { width: 390, height: 844, columns: 2 },
    { width: 768, height: 1024, columns: 2 },
    { width: 1440, height: 900, columns: 2 },
  ]) {
    await page.setViewportSize(viewport)
    const metrics = await grid.evaluate((element, columnCount) => {
      const gridRect = element.getBoundingClientRect()
      const cardRects = Array.from(element.children, child => child.getBoundingClientRect())
      return {
        gridLeft: Math.round(gridRect.left),
        gridWidth: gridRect.width,
        cardLefts: cardRects.map(rect => Math.round(rect.left)),
        cardWidths: cardRects.map(rect => rect.width),
        expectedMax: gridRect.width / Number(columnCount),
      }
    }, viewport.columns)
    expect(metrics.cardLefts[0]).toBe(metrics.gridLeft)
    expect(Math.max(...metrics.cardWidths)).toBeLessThanOrEqual(metrics.expectedMax + 4)
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
    await capture(
      page,
      `public-two-channels-${viewport.width}x${viewport.height}`,
      REQUIREMENT_2_SCREENSHOT_DIR,
    )
  }
})

test('官方渠道二维码上传使用 contact 分区版本，冲突后保留草稿并显示最新值', async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const pageA = await first.newPage()
  const pageB = await second.newPage()

  try {
    await openContentAdmin(pageA)
    await openContentAdmin(pageB)
    await card(pageB, 'contact').locator('#site-field-qq').fill('987654321')

    await card(pageA, 'contact').locator('#site-field-qq').fill('234567890')
    await card(pageA, 'contact').getByTestId('site-section-save').click()
    await expect(card(pageA, 'contact').getByTestId('site-section-saved')).toBeVisible()

    await chooseQr(pageB, 'qq', 'stale-contact', contactQrPng())
    const conflicted = card(pageB, 'contact')
    await expect(conflicted.getByTestId('site-section-conflict')).toBeVisible()
    await expect(conflicted.locator('#site-field-qq')).toHaveValue('987654321')
    await expect(conflicted.getByTestId('site-section-conflict')).toContainText('234567890')
    await expect(conflicted.getByRole('alert').last())
      .toContainText('联系方式已在其他地方变化')
  }
  finally {
    await first.close()
    await second.close()
  }
})

test('官方渠道分区并发：同分区第二个上下文冲突，不同分区都成功', async ({ browser }) => {
  const first = await browser.newContext()
  const second = await browser.newContext()
  const pageA = await first.newPage()
  const pageB = await second.newPage()

  try {
    await openContentAdmin(pageA)
    await openContentAdmin(pageB)

    await card(pageA, 'contact').locator('#site-field-qq_group').fill('234567890')
    await card(pageB, 'contact').locator('#site-field-qq_group').fill('345678901')

    await card(pageA, 'contact').getByTestId('site-section-save').click()
    await expect(card(pageA, 'contact').getByTestId('site-section-saved'))
      .toBeVisible()

    // 同一 contact 分区用陈旧版本保存：分区级 409，草稿保留。
    await card(pageB, 'contact').getByTestId('site-section-save').click()
    const conflictB = card(pageB, 'contact')
    await expect(conflictB.getByTestId('site-section-conflict')).toBeVisible()
    await expect(conflictB.locator('#site-field-qq_group')).toHaveValue('345678901')
    await expect(conflictB.getByTestId('site-section-conflict'))
      .toContainText('234567890')

    // 不同分区同时保存都成功：B 的 about 分区不受 contact 冲突影响。
    // 刻意不用 privacy：public-information.spec.ts 断言迁移 0015 种入的隐私
    // 政策正文，而 E2E 套件串行共用同一个库，改写它会让那条用例失败。
    await card(pageB, 'about').locator('#site-field-makingScope')
      .fill('制作范围：全装与半装。')
    await card(pageB, 'about').getByTestId('site-section-save').click()
    await expect(card(pageB, 'about').getByTestId('site-section-saved'))
      .toBeVisible()
  }
  finally {
    await first.close()
    await second.close()
  }
})
