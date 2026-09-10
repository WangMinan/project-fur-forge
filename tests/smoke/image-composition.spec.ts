import { writeFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { randomUUID } from 'node:crypto'
import { createSyntheticSourcePng } from '../../scripts/oss-preflight-core.mjs'
import { adminBaseURL, E2E_DATABASE_FILE, loginAsAdmin, publicBaseURL } from '../e2e/helpers/auth'
import { openFixtureDatabase } from '../e2e/helpers/fixture-db'
import { seedPublicCatalog } from '../e2e/helpers/public-catalog'
import type { ManagedWorkDto } from '../../shared/types/contracts'

test('R6 saves independent crops and display choices, then renders square thumbnails at six viewports', async ({ page }) => {
  test.setTimeout(180_000)
  await page.addInitScript(() => {
    const metrics = { lcp: 0, cls: 0 }
    Object.assign(window, { r6Metrics: metrics })
    new PerformanceObserver(list => { for (const item of list.getEntries()) metrics.lcp = item.startTime }).observe({ type: 'largest-contentful-paint', buffered: true })
    new PerformanceObserver(list => { for (const item of list.getEntries()) { const shift = item as PerformanceEntry & { value: number, hadRecentInput: boolean }; if (!shift.hadRecentInput) metrics.cls += shift.value } }).observe({ type: 'layout-shift', buffered: true })
  })
  const session = await loginAsAdmin(page)
  await seedPublicCatalog(page, [{
    slug: 'e2e-public-r6-composition', characterName: '构图验收', species: '犬科', purpose: 'adoption', adoptionStatus: 'available',
    publicationStatus: 'draft', featured: false,
    photos: [{ alt: '正面全身', width: 4209, height: 3003 }, { alt: '侧面全身', width: 2400, height: 3200 }],
    adoptionCover: { alt: '横版封面', width: 3200, height: 1800 }, designSheet: { alt: '完整设定', width: 3200, height: 2400 },
  }])
  const sqlite = openFixtureDatabase(E2E_DATABASE_FILE)
  let id: string
  try {
    id = sqlite.prepare("SELECT id FROM works WHERE slug='e2e-public-r6-composition'").pluck().get() as string
    // Seeded published catalogs normally need no upload ownership; this test edits those media.
    const assets = sqlite.prepare('SELECT a.* FROM assets a JOIN work_assets r ON r.asset_id=a.id WHERE r.work_id=?').all(id) as Array<Record<string, string | number>>
    const now = Date.now()
    for (const asset of assets) sqlite.prepare(`INSERT INTO upload_sessions
      (id,owner_type,owner_id,owner_version,media_role,private_object_key,expected_content_type,expected_bytes,
       expected_content_md5,expected_sha256,expected_width,expected_height,created_by,status,asset_id,version,created_at,expires_at,updated_at)
      VALUES (?,'work',?,1,?,?,?,?,?,?,?,?,?,'COMPLETED',?,1,?,?,?)`).run(randomUUID(), id, asset.role, asset.private_object_key,
      asset.mime_type, asset.byte_size, 'AAAAAAAAAAAAAAAAAAAAAA==', asset.sha256, asset.width, asset.height, session.user.id,
      asset.id, now, now + 300000, now)
  }
  finally { sqlite.close() }
  const headers = { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken }
  const read = async () => (await (await page.request.get(`${adminBaseURL}/api/admin/v1/works/${id}`)).json()).data as ManagedWorkDto
  // Thumbnail rounding and fractional layout must not corrupt the source crop ratio.
  await page.route('**/preview?w=640', route => route.fulfill({ contentType: 'image/png', body: createSyntheticSourcePng(640, 457) as Buffer }))
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewportSize({ width: 1280, height: 720 })
  await page.goto(`${adminBaseURL}/admin/works/${id}`)
  const photo = page.locator('#studio-photos .photo-card').first()
  await photo.getByRole('button', { name: '详情缩略图', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  await expect(dialog.getByRole('button', { name: '应用构图' })).toBeEnabled()
  const selection = dialog.locator('cropper-selection')
  const initial = await selection.boundingBox()
  if (!initial) throw new Error('Missing crop selection')
  await page.mouse.move(initial.x + initial.width / 2, initial.y + initial.height / 2)
  await page.mouse.down()
  await page.mouse.move(initial.x + initial.width / 2 + 20, initial.y + initial.height / 2, { steps: 10 })
  await page.mouse.up()
  await expect(dialog.getByRole('button', { name: '应用构图' })).toBeEnabled()
  expect((await selection.boundingBox())!.x).toBeGreaterThan(initial.x + 10)
  await dialog.getByRole('button', { name: '缩小选区' }).click()
  await dialog.getByRole('button', { name: '选区向上' }).click()
  await dialog.getByRole('button', { name: '应用构图' }).click()
  await page.locator('#studio-photos').getByRole('button', { name: '保存出厂照', exact: true }).click()
  await expect.poll(async () => (await read()).studioPhotos[0]?.compositions?.['detail-thumbnail']?.mode).toBe('crop')
  const first = (await read()).studioPhotos[0]!.compositions!['detail-thumbnail']
  if (first?.mode !== 'crop') throw new Error('Missing saved crop')
  expect(first.rect.width * 4209 / (first.rect.height * 3003)).toBeCloseTo(1, 10)
  await photo.getByRole('button', { name: /详情缩略图/ }).click()
  await expect(dialog.getByRole('button', { name: '应用构图' })).toBeEnabled()
  await dialog.getByRole('button', { name: '扩大选区' }).click()
  await page.keyboard.press('Escape')
  expect((await read()).studioPhotos[0]!.compositions!['detail-thumbnail']).toEqual(first)

  for (const [width, height] of [[390,844],[430,932],[768,1024],[1023,900],[1024,900],[1280,900],[1366,900],[1440,900]]) {
    await page.setViewportSize({ width: width!, height: height! })
    for (const card of await page.locator('.photo-card').all()) {
      const layout = await card.evaluate(el => {
        const frame = el.getBoundingClientRect()
        const buttons = [...el.querySelectorAll('.composition-controls > button, .photo-card__actions > button')].map(button => button.getBoundingClientRect())
        return {
          contained: buttons.every(b => b.left >= frame.left && b.right <= frame.right),
          overlapping: buttons.some((a, i) => buttons.slice(i + 1).some(b => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top)),
        }
      })
      expect(layout, `Photo controls at ${width}px`).toEqual({ contained: true, overlapping: false })
    }
    await photo.getByRole('button', { name: /详情缩略图/ }).click()
    await expect(dialog.getByRole('button', { name: '应用构图' })).toBeEnabled()
    const restored = await dialog.locator('cropper-selection').evaluate(el => {
      const value = el as HTMLElement & { x: number, y: number, width: number, height: number }
      const image = el.parentElement!.querySelector('cropper-image')!.getBoundingClientRect()
      const canvas = el.parentElement!.getBoundingClientRect()
      return { x: (value.x - image.left + canvas.left) / image.width, y: (value.y - image.top + canvas.top) / image.height,
        width: value.width / image.width, height: value.height / image.height }
    })
    if (first?.mode !== 'crop') throw new Error('Missing crop')
    expect(restored.x).toBeCloseTo(first.rect.x, 4)
    expect(restored.y).toBeCloseTo(first.rect.y, 4)
    expect(restored.width).toBeCloseTo(first.rect.width, 4)
    expect(restored.height).toBeCloseTo(first.rect.height, 4)
    expect(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)).toBe(false)
    if (width === 390 || width === 1440) await page.screenshot({ path: test.info().outputPath(`r6-editor-${width}.png`), fullPage: true })
    await page.keyboard.press('Escape')
  }
  await photo.getByRole('button', { name: /作品目录/ }).click()
  await expect(dialog.getByRole('button', { name: '应用构图' })).toBeEnabled()
  await dialog.getByRole('button', { name: '完整显示', exact: true }).click()
  await dialog.getByRole('button', { name: '应用构图' }).click()
  await page.locator('#studio-photos').getByRole('button', { name: '保存出厂照', exact: true }).click()
  await expect.poll(async () => (await read()).studioPhotos[0]?.compositions?.['work-catalog']?.mode).toBe('contain')

  await page.getByLabel('领养封面来源', { exact: true }).selectOption('adoption_cover')
  await page.getByLabel('在详情图集中显示领养横版封面', { exact: true }).uncheck()
  await page.getByLabel('在详情图集中显示设定图', { exact: true }).uncheck()
  await page.getByRole('button', { name: '保存展示设置' }).click()
  await expect.poll(async () => (await read()).showAdoptionCoverInDetail).toBe(false)
  const current = await read()
  const publish = await page.request.post(`${adminBaseURL}/api/admin/v1/works/${id}/publish`, {
    headers, data: { expectedVersion: current.version, payload: {} }, timeout: 90000,
  })
  expect(publish.ok(), await publish.text()).toBe(true)
  const publicDetail = await (await page.request.get(`${publicBaseURL}/api/public/v1/works/e2e-public-r6-composition`)).json()
  expect(publicDetail.data.media.adoptionCover).toBeUndefined()
  expect(publicDetail.data.media.designSheet).toBeUndefined()
  expect(publicDetail.data.media.gallery).toHaveLength(2)

  const measurements: Array<Record<string, unknown>> = []
  for (const [width, height] of [[390,844],[430,932],[768,1024],[1023,900],[1024,900],[1440,900]]) {
    await page.setViewportSize({ width: width!, height: height! })
    await page.goto(`${publicBaseURL}/works/e2e-public-r6-composition?from=adoptions`)
    await page.waitForFunction(() => Boolean((document.querySelector('#__nuxt') as Element & { __vue_app__?: unknown })?.__vue_app__))
    const thumbs = page.locator('.work-gallery__thumb')
    await expect(thumbs).toHaveCount(2)
    const box = await thumbs.first().boundingBox()
    expect(Math.abs(box!.width - box!.height)).toBeLessThan(1)
    expect(box!.width).toBeGreaterThanOrEqual(44)
    await page.waitForFunction(() => Boolean((document.querySelector('.work-gallery') as Element & { __vueParentComponent?: { isMounted: boolean } })?.__vueParentComponent?.isMounted))
    const touch = await page.context().newCDPSession(page)
    await touch.send('Emulation.setTouchEmulationEnabled', { enabled: true })
    await thumbs.last().scrollIntoViewIfNeeded()
    const target = await thumbs.last().boundingBox()
    await touch.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: target!.x + target!.width / 2, y: target!.y + target!.height / 2 }] })
    await touch.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await touch.send('Emulation.setEmulatedMedia', { features: [{ name: 'prefers-reduced-motion', value: 'reduce' }, { name: 'prefers-reduced-transparency', value: 'reduce' }, { name: 'prefers-contrast', value: 'more' }] })
    await touch.detach()
    await expect(thumbs.last()).toHaveAttribute('aria-pressed', 'true')
    const overflowing = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth)
    expect(overflowing).toBe(false)
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await thumbs.first().focus()
    await page.keyboard.press('Enter')
    await expect(thumbs.first()).toHaveAttribute('aria-pressed', 'true')
    const decode = await page.locator('.work-gallery img').evaluateAll(async images => Promise.all(images.map(async image => { try { await (image as HTMLImageElement).decode(); return true } catch { return false } })))
    expect(decode.every(Boolean)).toBe(true)
    const metrics = await page.evaluate(() => (window as unknown as { r6Metrics: { lcp: number, cls: number } }).r6Metrics)
    measurements.push({ width, height, thumbnail: box, overflowing, decode, ...metrics })
  }
  expect(errors).toEqual([])
  const evidence = test.info().outputPath('r6-viewports.json')
  writeFileSync(evidence, JSON.stringify(measurements, null, 2) + '\n')
  await test.info().attach('r6-viewports.json', { path: evidence, contentType: 'application/json' })
  await page.screenshot({ path: test.info().outputPath('r6-detail.png'), fullPage: true })
  // The next catalog test must be able to remove assets with completed upload ownership.
  await seedPublicCatalog(page, [])
  const cleaned = openFixtureDatabase(E2E_DATABASE_FILE)
  try {
    expect(cleaned.prepare('SELECT count(*) AS count FROM upload_sessions WHERE owner_id = ?').get(id)).toEqual({ count: 0 })
    expect(cleaned.pragma('foreign_key_check')).toEqual([])
  }
  finally { cleaned.close() }
})
