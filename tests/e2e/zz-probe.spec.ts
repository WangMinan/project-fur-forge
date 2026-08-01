import { readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { resolve } from 'node:path'
import { expect, test } from '@playwright/test'
import { adminBaseURL, loginAsAdmin } from './helpers/auth'
import { createWorkViaApi } from './helpers/admin-work'
import { resetFakeMedia, smallStudioPng, uploadFileToEditor } from './helpers/fake-media'

test('probe: 出厂照本地预览 img 状态', async ({ page }) => {
  const consoleMessages: string[] = []
  page.on('console', message => consoleMessages.push(`[${message.type()}] ${message.text()}`))
  page.on('pageerror', error => consoleMessages.push(`[pageerror] ${error.message}`))

  await loginAsAdmin(page)
  await resetFakeMedia(page)
  const work = await createWorkViaApi(page, { characterName: '预览探针' })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
  await page.waitForSelector('.editor-card')

  await uploadFileToEditor(page, smallStudioPng(), 'probe.png')
  const card = page.locator('article.photo-card')
  await expect(card).toHaveCount(1)
  await expect(card.first()).toContainText('READY')

  const probe = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('[data-testid="photo-preview"] img')
    if (!img) {
      return { found: false as const }
    }
    return {
      found: true as const,
      src: img.src,
      currentSrc: img.currentSrc,
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }
  })
  console.log('IMG PROBE:', JSON.stringify(probe, null, 2))

  if (probe.found) {
    const fetchResult = await page.evaluate(async (src) => {
      try {
        const response = await fetch(src)
        const blob = await response.blob()
        return { ok: true, status: response.status, size: blob.size, type: blob.type }
      }
      catch (error) {
        return { ok: false, error: String(error) }
      }
    }, probe.src)
    console.log('FETCH PROBE:', JSON.stringify(fetchResult, null, 2))
  }

  console.log('CONSOLE:', JSON.stringify(consoleMessages, null, 2))
})

test('probe: 用户真实 23MB PNG 的本地预览', async ({ page }) => {
  test.setTimeout(120_000)
  const consoleMessages: string[] = []
  page.on('console', message => consoleMessages.push(`[${message.type()}] ${message.text()}`))
  page.on('pageerror', error => consoleMessages.push(`[pageerror] ${error.message}`))

  await loginAsAdmin(page)
  await resetFakeMedia(page)
  const work = await createWorkViaApi(page, { characterName: '大图预览探针' })
  await page.goto(`${adminBaseURL}/admin/works/${work.id}`)
  await page.waitForSelector('.editor-card')

  const content = readFileSync(resolve(tmpdir(), 'user-photo-large.png'))
  await uploadFileToEditor(page, content, 'user-photo-large.png')
  const card = page.locator('article.photo-card')
  await expect(card).toHaveCount(1, { timeout: 90_000 })
  await expect(card.first()).toContainText('READY', { timeout: 90_000 })

  // 给 img 解码留出时间后再采样。
  await page.waitForTimeout(3_000)
  const probe = await page.evaluate(() => {
    const img = document.querySelector<HTMLImageElement>('[data-testid="photo-preview"] img')
    if (!img) {
      return { found: false as const }
    }
    return {
      found: true as const,
      src: img.src.slice(0, 64),
      complete: img.complete,
      naturalWidth: img.naturalWidth,
      naturalHeight: img.naturalHeight,
    }
  })
  console.log('LARGE IMG PROBE:', JSON.stringify(probe, null, 2))
  console.log('CONSOLE:', JSON.stringify(consoleMessages, null, 2))
})
