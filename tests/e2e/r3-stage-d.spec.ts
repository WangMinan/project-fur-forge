import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { seedPublicCatalog } from './helpers/public-catalog'

const adoptionSlug = 'e2e-public-r3-stage-d-adoption'

async function seedStageD(page: import('@playwright/test').Page) {
  await seedPublicCatalog(page, [
    {
      slug: adoptionSlug,
      characterName: '合成领养角色',
      species: '犬科',
      purpose: 'adoption',
      adoptionStatus: 'available',
      priceCnyMinor: 128_000,
      adoptionCover: {
        alt: '合成领养角色横版封面',
        width: 3200,
        height: 1800,
      },
      designSheet: {
        alt: '合成领养角色设定图',
        width: 2400,
        height: 3200,
      },
      photos: [{ alt: '合成领养角色主出厂照', width: 2400, height: 3200 }],
    },
    {
      slug: 'e2e-public-r3-stage-d-commission',
      characterName: '合成委托作品',
      species: '狐科',
      purpose: 'commission',
      photos: [{ alt: '合成委托作品主出厂照' }],
    },
    {
      slug: 'e2e-public-r3-stage-d-showcase',
      characterName: '合成展示作品',
      species: '猫科',
      purpose: 'showcase',
      photos: [{ alt: '合成展示作品主出厂照' }],
    },
  ])
}

test.beforeAll(async ({ browser }) => {
  const page = await browser.newPage()
  await seedStageD(page)
  await page.close()
})

test('公开 DTO 只保留目标字段，三类媒体各自投影', async ({ request }) => {
  const listResponse = await request.get('/api/public/v1/works')
  expect(listResponse.status()).toBe(200)
  const listJson = await listResponse.json()
  expect(listJson.data.items).toHaveLength(3)
  expect(JSON.stringify(listJson)).not.toMatch(
    /suitType|ownerDisplay|ownerContact|featureTags|businessStatus|adoptionMethod|eventName|eventTime/u,
  )

  const adoptionResponse = await request.get('/api/public/v1/adoptions')
  expect(adoptionResponse.status()).toBe(200)
  const adoptionJson = await adoptionResponse.json()
  expect(adoptionJson.data.items).toHaveLength(1)
  expect(adoptionJson.data.items[0].work).toMatchObject({
    adoptionStatus: 'available',
    characterName: '合成领养角色',
    price: { currency: 'CNY', minorUnits: 128_000 },
    species: '犬科',
  })
  expect(adoptionJson.data.items[0].cover.alt).toBe('合成领养角色横版封面')

  const detailResponse = await request.get(`/api/public/v1/works/${adoptionSlug}`)
  expect(detailResponse.status()).toBe(200)
  const detailJson = await detailResponse.json()
  expect(detailJson.data.media.card.alt).toBe('合成领养角色主出厂照')
  expect(detailJson.data.media.designSheet.alt).toBe('合成领养角色设定图')
  expect(detailJson.data.media.gallery[0].alt).toBe('合成领养角色主出厂照')
  expect(JSON.stringify(detailJson)).not.toContain('adoption_cover')
})

test('作品与领养在 390、768、1440 三视口无旧筛选、无溢出且图片解码', async ({ page }) => {
  for (const viewport of [
    { width: 390, height: 844 },
    { width: 768, height: 1024 },
    { width: 1440, height: 900 },
  ]) {
    await page.setViewportSize(viewport)
    await page.goto('/works')
    await expect(page.locator('[data-work-slug]')).toHaveCount(3)
    await expect(page.getByRole('group', { name: /筛选/u })).toHaveCount(0)
    await expect(page.getByText(/全装|半装|主人|标签|制作中/u)).toHaveCount(0)
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)

    await page.goto('/adoptions')
    const card = page.locator(`[data-work-slug="${adoptionSlug}"]`)
    await expect(card).toContainText('合成领养角色')
    await expect(card).toContainText('可领养')
    await expect(card).toContainText('¥1,280')
    const image = card.locator('img')
    await expect(image).toHaveJSProperty('complete', true)
    expect(await image.evaluate(node => (node as HTMLImageElement).naturalWidth)).toBeGreaterThan(0)
    const canvas = await card.locator('.adoption-card__canvas').boundingBox()
    expect(canvas).not.toBeNull()
    expect(canvas!.width / canvas!.height).toBeCloseTo(16 / 9, 1)
    expect(await page.evaluate(() => (
      document.documentElement.scrollWidth - document.documentElement.clientWidth
    ))).toBeLessThanOrEqual(1)
  }

  await page.goto(`/works/${adoptionSlug}`)
  // 出厂照、领养封面与设定图并入同一查看序列，不再有独立「设定图」分区。
  await expect(page.getByRole('heading', { level: 2, name: '出厂照 / 作品图集' })).toBeVisible()
  await expect(page.getByRole('heading', { level: 2, name: '设定图' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /查看第 \d 张，共 3 张/ })).toHaveCount(3)
})

test('管理端要求人工选择领养状态且不再呈现旧业务字段', async ({ page }) => {
  await loginAsAdmin(page)
  await page.goto(`${adminBaseURL}/admin/works/new`)
  await page.getByLabel('角色名 *').fill('人工复核合成角色')
  await page.getByLabel('物种 *').fill('犬科')
  await page.getByLabel('公开地址 *').fill(`e2e-admin-review-${Date.now().toString(36)}`)
  await page.getByLabel('内部用途 *').selectOption('adoption')

  const status = page.getByLabel('领养状态 *')
  await expect(status).toHaveValue('')
  await expect(status.locator('option:checked')).toHaveText('请人工确认')
  await expect(page.getByText('不得根据历史状态自动猜测')).toBeVisible()
  await expect(page.getByLabel(/装型|主人|联系人|领养方式|展会/u)).toHaveCount(0)

  await page.getByRole('button', { name: '创建草稿' }).click()
  await expect(page.getByRole('alert')).toContainText('填写内容未通过校验')
  await status.selectOption('adopted')
  await page.getByRole('button', { name: '创建草稿' }).click()
  await expect(page).toHaveURL(/\/admin\/works\/[0-9a-f-]+$/u)
  await expect(page.getByRole('heading', { name: '领养横版封面' })).toBeVisible()
})
