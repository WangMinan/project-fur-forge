import { expect, test } from '@playwright/test'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { adminBaseURL, E2E_DATABASE_FILE, loginAsAdmin } from '../e2e/helpers/auth'
import { openFixtureDatabase } from '../e2e/helpers/fixture-db'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'

test('single-image editors retain rejected drafts and save independent uploads without manual ordering', async ({ page }, testInfo) => {
  await loginAsAdmin(page)
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-single-editor', characterName: '单图编辑验收', species: '犬科', purpose: 'adoption',
    adoptionStatus: 'available', publicationStatus: 'draft', featured: false,
    photos: [{ alt: '合成出厂照' }], adoptionCover: { alt: '原封面' }, designSheet: { alt: '原设定图' },
  }])
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  const id = sqlite.prepare("SELECT id FROM works WHERE slug='e2e-public-single-editor'").pluck().get() as string
  sqlite.close()
  await page.goto(`${adminBaseURL}/admin/works/${id}`)
  await expect(page.locator('#design-sheet')).toBeVisible()
  await expect(page.locator('#f-sort')).toHaveCount(0)
  for (const [sectionId, label] of [['design-sheet', '设定图'], ['adoption-cover', '横版封面']]) {
    const section = page.locator(`#${sectionId}`)
    await section.getByRole('button', { name: `移除${label}`, exact: true }).click()
    await section.locator('input[type=file]').setInputFiles({
      name: 'synthetic.png', mimeType: 'image/png', buffer: createSyntheticSourcePng(128, 96),
    })
    await section.getByRole('button', { name: `上传${label}`, exact: true }).click()
    const alt = section.getByLabel('图片说明', { exact: false })
    await expect(alt).toBeVisible()
    await alt.fill(`新${label}`)
    const endpoint = `**/api/admin/v1/works/${id}/${sectionId}`
    await page.route(endpoint, route => route.fulfill({ status: 409, json: {
      error: { code: 'CONFLICT', reason: 'DETAIL_GALLERY_EMPTY', message: 'Synthetic rejected save.' },
    } }))
    await section.getByRole('button', { name: `保存${label}`, exact: true }).click()
    await expect(section.getByRole('alert')).toContainText('至少保留一张图片')
    await expect(alt).toHaveValue(`新${label}`)
    await page.unroute(endpoint)
    await section.getByRole('button', { name: `保存${label}`, exact: true }).click()
    await expect(section.getByRole('button', { name: `保存${label}`, exact: true })).toHaveCount(0)
    await expect(alt).toHaveValue(`新${label}`)
  }
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await page.screenshot({ path: testInfo.outputPath(`single-image-${width}.png`), fullPage: true })
  }
  await page.reload()
  await expect(page.locator('#design-sheet').getByLabel('图片说明', { exact: false })).toHaveValue('新设定图')
  await expect(page.locator('#adoption-cover').getByLabel('图片说明', { exact: false })).toHaveValue('新横版封面')
})
