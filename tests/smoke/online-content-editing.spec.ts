import { expect, test } from '@playwright/test'
import { adminBaseURL, E2E_DATABASE_FILE, loginAsAdmin, publicBaseURL } from '../e2e/helpers/auth'
import { openFixtureDatabase } from '../e2e/helpers/fixture-db'
import { seedHeroCollections, seedPublicCatalog } from '../e2e/helpers/public-catalog'

test('published work text saves without unpublishing, while image controls stay locked', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  const mediaMutations: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('request', request => {
    if (request.method() !== 'GET' && /\/(?:publish|unpublish|upscale|preview)(?:\?|$)/u.test(request.url())) mediaMutations.push(request.url())
  })
  await loginAsAdmin(page)
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-online-text', characterName: '在线维护测试', species: '犬科', purpose: 'adoption',
    adoptionStatus: 'available', photos: [{ alt: '原出厂照' }], adoptionCover: { alt: '原封面' }, designSheet: { alt: '原设定图' },
  }])
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    const id = sqlite.prepare("SELECT id FROM works WHERE slug='e2e-public-online-text'").pluck().get() as string
    const publication = sqlite.prepare('SELECT published_at, publication_status FROM works WHERE id=?').get(id)
    const assets = sqlite.prepare('SELECT * FROM assets ORDER BY id').all()
    const variants = sqlite.prepare('SELECT * FROM asset_variants ORDER BY id').all()
    await page.goto(`${adminBaseURL}/admin/works/${id}`)
    await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
    const save = page.getByRole('button', { name: '保存修改', exact: true })
    await page.locator('#f-artist').fill('在线画师')
    await page.locator('#f-name').fill('修改后的角色')
    await page.locator('#f-price').fill('1234.50')
    const endpoint = `**/api/admin/v1/works/${id}`
    await page.route(endpoint, route => route.request().method() === 'PUT'
      ? route.fulfill({ status: 500, json: { error: { code: 'INTERNAL_ERROR', message: 'Synthetic failure.' } } }) : route.continue())
    await save.click()
    await expect(page.getByRole('alert').filter({ hasText: '保存失败' })).toBeVisible()
    await expect(page.locator('#f-artist')).toHaveValue('在线画师')
    await page.unroute(endpoint)
    await save.click()
    await expect(page.getByText('修改已保存，公开端已更新。', { exact: true })).toBeVisible()
    for (const [sectionId, label] of [['design-sheet', '设定图'], ['adoption-cover', '横版封面'], ['studio-photos', '出厂照']]) {
      const section = page.locator(`#${sectionId}`)
      const alt = section.getByLabel('图片说明', { exact: false })
      await alt.fill(`在线${label}说明`)
      await section.getByRole('button', { name: `保存${label}`, exact: true }).click()
      await expect(section.getByRole('button', { name: `保存${label}`, exact: true })).toHaveCount(0)
      await expect(section.getByRole('button', { name: /^移除/u })).toBeDisabled()
    }
    await expect(page.locator('#studio-photos').getByRole('button', { name: '选择照片' })).toBeDisabled()
    await page.reload()
    await expect(page.locator('#f-artist')).toHaveValue('在线画师')
    await expect(page.locator('#design-sheet').getByLabel('图片说明', { exact: false })).toHaveValue('在线设定图说明')
    await expect(page.locator('#adoption-cover').getByLabel('图片说明', { exact: false })).toHaveValue('在线横版封面说明')
    await expect(page.locator('#studio-photos').getByLabel('图片说明', { exact: false })).toHaveValue('在线出厂照说明')
    const publicDetail = await (await page.request.get(`${publicBaseURL}/api/public/v1/works/e2e-public-online-text`)).json()
    expect(publicDetail.data.adoption).toMatchObject({ artist: '在线画师', priceCnyMinor: 123450 })
    expect(publicDetail.data.media.gallery[0].alt).toBe('在线出厂照说明')
    for (const width of [1440, 390]) {
      await page.setViewportSize({ width, height: 900 })
      await page.locator('#f-artist').scrollIntoViewIfNeeded()
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: testInfo.outputPath(`work-${width}.png`) })
    }
    await page.emulateMedia({ reducedMotion: 'reduce', contrast: 'more' })
    await page.locator('#f-artist').fill('冲突时保留输入')
    sqlite.prepare('UPDATE works SET version=version+1 WHERE id=?').run(id)
    await save.click()
    await expect(page.getByRole('dialog', { name: '作品版本已变化' })).toBeVisible()
    await page.getByRole('button', { name: '继续编辑', exact: true }).click()
    await expect(page.locator('#f-artist')).toHaveValue('冲突时保留输入')
    expect(sqlite.prepare('SELECT published_at, publication_status FROM works WHERE id=?').get(id)).toEqual(publication)
    expect(sqlite.prepare('SELECT * FROM assets ORDER BY id').all()).toEqual(assets)
    expect(sqlite.prepare('SELECT * FROM asset_variants ORDER BY id').all()).toEqual(variants)
    expect(mediaMutations).toEqual([])
    expect(errors).toEqual([])
  }
  finally { sqlite.close() }
})

test('enabled Hero saves only its description and retains drafts after a conflict', async ({ page }, testInfo) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await loginAsAdmin(page)
  await seedHeroCollections(page, {
    landscape: [{ alt: '唯一启用图', sortOrder: 0, enabled: true }],
    portrait: [{ alt: '竖版启用图', sortOrder: 0, enabled: true }],
  })
  await page.goto(`${adminBaseURL}/admin/site/home`)
  await page.waitForFunction(() => Boolean((document.getElementById('__nuxt') as HTMLElement & { __vue_app__?: unknown })?.__vue_app__))
  const card = page.getByTestId('hero-collection-item').filter({ has: page.getByRole('button', { name: '停用并撤销公开图' }) }).first()
  const description = card.getByLabel('替代文字', { exact: true })
  const save = card.getByRole('button', { name: '保存', exact: true })
  await expect(description).toHaveValue('唯一启用图')
  await expect(card.getByRole('button', { name: '选择图片' })).toHaveCount(0)
  await expect(card.getByRole('slider')).toHaveCount(0)
  const before = await (await page.request.get(`${publicBaseURL}/api/public/v1/home`)).json()
  await description.fill('无需停用的新说明')
  const saved = page.waitForResponse(response => response.request().method() === 'PUT' && response.url().includes('/hero-collections/'))
  await save.focus()
  await page.keyboard.press('Enter')
  const response = await saved
  expect(response.status()).toBe(200)
  expect(response.request().postDataJSON().payload).toEqual({ alt: '无需停用的新说明' })
  await expect(card).toContainText('说明已保存，公开端已更新。')
  const after = await (await page.request.get(`${publicBaseURL}/api/public/v1/home`)).json()
  expect(after.data.landscape[0]).toEqual({ ...before.data.landscape[0], alt: '无需停用的新说明' })
  await page.reload()
  await expect(description).toHaveValue('无需停用的新说明')
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    await description.scrollIntoViewIfNeeded()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
    await expect.poll(() => card.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
    await page.screenshot({ path: testInfo.outputPath(`hero-${width}.png`), fullPage: true })
  }
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    sqlite.prepare("UPDATE site_hero_collections SET version=version+1 WHERE placement='home' AND orientation='landscape'").run()
    // Simulate another editor changing this same item, which used to overwrite the local draft on refresh.
    sqlite.prepare("UPDATE site_hero_items SET alt_text='另一个管理员的说明', version=version+1 WHERE placement='home' AND orientation='landscape'").run()
  }
  finally { sqlite.close() }
  await description.fill('冲突草稿')
  await save.click()
  await expect(page.getByText(/输入已保留/u)).toBeVisible()
  await expect(description).toHaveValue('冲突草稿')
  await page.getByRole('button', { name: '放弃未保存修改并刷新' }).click()
  await expect(description).toHaveValue('另一个管理员的说明')
  expect(errors).toEqual([])
})
