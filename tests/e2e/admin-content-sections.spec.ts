import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin, publicBaseURL } from './helpers/auth'
import {
  contactQrPng,
  fakeMediaState,
  nonSquareContactQrPng,
  resetFakeMedia,
  setFakeMediaFlags,
} from './helpers/fake-media'
import { capture } from './helpers/screenshots'

const SCREENSHOT_DIR
  = 'agent_docs/需求1-兽装工作室主页/implementation/notes/t34-c1/screenshots'

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
  platformLabel: string,
  content: Buffer,
) {
  const chooser = page.waitForEvent('filechooser')
  await card(page, 'contact').locator('[data-platform="qq"]')
    .getByRole('button', { name: /二维码/u }).click()
  await (await chooser).setFiles({
    name: `${platformLabel}.png`,
    mimeType: 'image/png',
    buffer: content,
  })
}

test('六个文案分区各自独立保存，互不禁用', async ({ page }) => {
  await openContentAdmin(page)

  const sections = [
    'commission',
    'commission-faq',
    'about',
    'terms',
    'privacy',
    'contact',
  ]
  for (const section of sections) {
    await expect(card(page, section)).toBeVisible()
  }

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

test('官方渠道 Card：邮箱、QQ、抖音号和防诈骗提醒一次保存并投影到公开页', async ({ page }) => {
  await openContentAdmin(page)
  const channels = card(page, 'contact')

  // 四个字段都在同一张 Card 里可编辑，共用一次局部保存。
  await expect(channels.locator('#site-field-email')).toBeEditable()
  await expect(channels.locator('#site-field-qq')).toBeEditable()
  await expect(channels.locator('#site-field-douyin')).toBeEditable()
  await expect(channels.locator('#site-field-antiScam')).toBeEditable()

  await channels.locator('#site-field-email').fill('channels@example.test')
  await channels.locator('#site-field-qq').fill('123456789')
  await channels.locator('#site-field-douyin').fill('studio.official')
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
    contact.getByRole('link', { name: 'channels@example.test' }),
  ).toHaveAttribute('href', 'mailto:channels@example.test')
  // 账号没有 READY 二维码时不进入公开渠道列表。
  await expect(contact.getByText('123456789', { exact: true })).toHaveCount(0)
})

test('官方渠道二维码：固定五行、前置校验、失败重试、保存和预览恢复', async ({ page }) => {
  await resetFakeMedia(page)
  await openContentAdmin(page)
  const channels = card(page, 'contact')
  const rows = channels.locator('[data-platform]')
  await expect(rows).toHaveCount(5)
  expect(await rows.evaluateAll(elements => elements.map(
    element => element.getAttribute('data-platform'),
  ))).toEqual([
    'qq',
    'douyin',
    'qq_group',
    'xiaohongshu',
    'bilibili',
  ])

  const qq = channels.locator('[data-platform="qq"]')
  await expect(qq).toContainText('公开页暂不显示')

  // 非方形 PNG 在浏览器端直接拒绝，不创建上传会话。
  await chooseQr(page, 'not-square', nonSquareContactQrPng())
  await expect(qq.getByRole('alert')).toContainText('至少 320×320 的方形 PNG')
  expect((await fakeMediaState(page)).putRecords).toHaveLength(0)

  // 公开派生失败保留私有原图并提供现有 retry-processing 动作。
  await setFakeMediaFlags(page, { failProcess: true })
  await chooseQr(page, 'qq', contactQrPng())
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

    await chooseQr(pageB, 'stale-contact', contactQrPng())
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

    await card(pageA, 'contact').locator('#site-field-douyin').fill('a.official')
    await card(pageB, 'contact').locator('#site-field-douyin').fill('b.official')

    await card(pageA, 'contact').getByTestId('site-section-save').click()
    await expect(card(pageA, 'contact').getByTestId('site-section-saved'))
      .toBeVisible()

    // 同一 contact 分区用陈旧版本保存：分区级 409，草稿保留。
    await card(pageB, 'contact').getByTestId('site-section-save').click()
    const conflictB = card(pageB, 'contact')
    await expect(conflictB.getByTestId('site-section-conflict')).toBeVisible()
    await expect(conflictB.locator('#site-field-douyin')).toHaveValue('b.official')
    await expect(conflictB.getByTestId('site-section-conflict'))
      .toContainText('a.official')

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

test('FAQ 稳定 ID：新增、删除、重排不串行为', async ({ page }) => {
  await openContentAdmin(page)
  const faq = card(page, 'commission-faq')

  // 数据库自带种子 FAQ；先清空到 0 项，专注验证新增两项的行为，
  // 不假设初始条数。
  await expect(faq.getByTestId('site-section-save')).toBeVisible()
  let remaining = await faq.locator('[data-faq-id]').count()
  while (remaining > 0) {
    await faq.getByLabel('删除第 1 项').click()
    remaining -= 1
  }
  await faq.getByTestId('site-section-save').click()
  await expect(faq.getByTestId('site-section-saved')).toBeVisible()
  await expect(faq.locator('[data-faq-id]')).toHaveCount(0)

  await faq.getByTestId('site-faq-add').click()
  await faq.getByLabel('第 1 项问题').fill('交期多久')
  await faq.getByLabel('第 1 项回答').fill('约三个月')
  await faq.getByTestId('site-faq-add').click()
  await faq.getByLabel('第 2 项问题').fill('可以改设定吗')
  await faq.getByLabel('第 2 项回答').fill('定稿前可以')
  await faq.getByTestId('site-section-save').click()
  await expect(faq.getByTestId('site-section-saved')).toBeVisible()

  const idsBefore = await faq.locator('[data-faq-id]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-faq-id')),
  )
  expect(idsBefore).toHaveLength(2)
  expect(new Set(idsBefore).size).toBe(2)

  // 重排：顺序变化但 ID 与内容跟随各自的行，不发生错位。
  await faq.getByLabel('下移第 1 项').click()
  await expect(faq.getByLabel('第 1 项问题')).toHaveValue('可以改设定吗')
  await expect(faq.getByLabel('第 2 项问题')).toHaveValue('交期多久')
  const idsAfterMove = await faq.locator('[data-faq-id]').evaluateAll(
    rows => rows.map(row => row.getAttribute('data-faq-id')),
  )
  expect(idsAfterMove).toEqual([idsBefore[1], idsBefore[0]])

  await faq.getByTestId('site-section-save').click()
  await expect(faq.getByTestId('site-section-saved')).toBeVisible()

  // 删除第一项后，剩下那项仍是原来的 ID 和内容。
  await faq.getByLabel('删除第 1 项').click()
  await expect(faq.getByLabel('第 1 项问题')).toHaveValue('交期多久')
  await faq.getByTestId('site-section-save').click()
  await expect(faq.getByTestId('site-section-saved')).toBeVisible()

  await page.reload()
  const reloaded = card(page, 'commission-faq')
  await expect(reloaded.locator('[data-faq-id]')).toHaveCount(1)
  await expect(reloaded.getByLabel('第 1 项问题')).toHaveValue('交期多久')
  expect(await reloaded.locator('[data-faq-id]').getAttribute('data-faq-id'))
    .toBe(idsBefore[0])
})
