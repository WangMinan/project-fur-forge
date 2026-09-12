import { mkdirSync } from 'node:fs'
import { expect, test } from '@playwright/test'
import { adminBaseURL, publicBaseURL, loginAsAdmin } from '../e2e/helpers/auth'

test('admin multilingual copy saves, protects drafts, detects conflict and renders fallback', async ({ page, request }) => {
  test.setTimeout(120_000)
  const session = await loginAsAdmin(page)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const base = `${adminBaseURL}/api/admin/v1/site/home/content/localized`
  expect((await request.get(`${base}/en`)).status()).toBe(401)
  expect((await page.request.put(`${base}/en/home`, { data: { expectedVersion: 1, payload: { tagline: 'blocked' } }, headers: { Origin: adminBaseURL } })).status()).toBe(403)
  const initial = (await (await page.request.get(`${base}/en`)).json()).data
  await page.goto(`${adminBaseURL}/admin/site/content`)
  const language = page.getByRole('group', { name: '编辑语言' })
  await expect(language.getByRole('button', { name: '中文', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await language.getByRole('button', { name: 'English', exact: true }).click()
  const about = page.locator('[data-section="about"]')
  const facts = about.getByLabel('工作室介绍', { exact: true })
  await expect(facts).toHaveValue(initial.sections.about.fields.studioFacts ?? '')
  await facts.fill('Editable English copy')
  page.once('dialog', dialog => dialog.dismiss())
  await language.getByRole('button', { name: '中文', exact: true }).click()
  await expect(language.getByRole('button', { name: 'English', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(facts).toHaveValue('Editable English copy')
  await page.getByRole('button', { name: '营业与联系', exact: true }).click()
  await page.getByRole('button', { name: '公开文案', exact: true }).click()
  await expect(facts).toHaveValue('Editable English copy')
  const headers = { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken }
  const remote = await page.request.put(`${base}/en/about`, {
    headers, data: { expectedVersion: initial.sections.about.version, payload: { ...initial.sections.about.fields, studioFacts: 'Remote edit' } },
  })
  expect(remote.status()).toBe(200)
  await about.getByTestId('site-section-save').click()
  await expect(about.getByTestId('site-section-conflict')).toBeVisible()
  await expect(facts).toHaveValue('Editable English copy')
  await about.getByTestId('site-section-save').click()
  await expect(about.getByTestId('site-section-saved')).toBeVisible()
  let html = await (await request.get(`${publicBaseURL}/about`, { headers: { 'accept-language': 'en' } })).text()
  expect(html).toContain('Editable English copy')
  await facts.fill('')
  await about.getByTestId('site-section-save').click()
  await expect(about.getByTestId('site-section-saved')).toBeVisible()
  await page.reload()
  await language.getByRole('button', { name: 'English', exact: true }).click()
  await expect(facts).toHaveValue('')
  const zh = (await (await page.request.get(`${base}/zh-CN`)).json()).data
  html = await (await request.get(`${publicBaseURL}/about`, { headers: { 'accept-language': 'en' } })).text()
  expect(html).toContain(zh.source.about.studioFacts.split('\n')[0])
  for (const width of [390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
    await language.getByRole('button', { name: 'English', exact: true }).focus()
    await expect(language.getByRole('button', { name: 'English', exact: true })).toBeFocused()
    mkdirSync('agent_docs/需求7-公开站中英切换/artifacts/screenshots', { recursive: true })
    await page.screenshot({ path: `agent_docs/需求7-公开站中英切换/artifacts/screenshots/admin-copy-${width}.png` })
  }
  expect(errors).toEqual([])
  const latest = (await (await page.request.get(`${base}/en`)).json()).data
  expect((await page.request.put(`${base}/en/about`, { headers, data: { expectedVersion: latest.sections.about.version, payload: initial.sections.about.fields } })).status()).toBe(200)
})


test('shared X configuration updates every public contact entry and segmented navigation', async ({ page, request }) => {
  test.setTimeout(120_000)
  const session = await loginAsAdmin(page)
  const endpoint = `${adminBaseURL}/api/admin/v1/site/home/content`
  const initial = (await (await page.request.get(endpoint)).json()).data
  const headers = { Origin: adminBaseURL, 'x-csrf-token': session.csrfToken }
  const changed = 'https://x.com/updated_account'
  try {
    await page.goto(`${adminBaseURL}/admin/site/content`)
    await page.getByRole('button', { name: '营业与联系', exact: true }).click()
    const card = page.locator('[data-section="contact"]')
    const input = card.getByLabel('X 主页链接（非大陆委托）', { exact: true })
    await expect(input).toHaveValue(initial.contact.xContactUrl)
    await input.fill('https://invalid.example/account')
    await expect(card.getByTestId('site-section-save')).toBeDisabled()
    await input.fill(`${changed}/`)
    await card.getByTestId('site-section-save').click()
    await expect(card.getByTestId('site-section-saved')).toBeVisible()
    await page.reload()
    await page.getByRole('button', { name: '营业与联系', exact: true }).click()
    await expect(input).toHaveValue(changed)
    for (const path of ['/about', '/commission', '/commission/apply']) {
      const response = await request.get(`${publicBaseURL}${path}`, { headers: { 'accept-language': 'en' } })
      expect(response.status()).toBe(200)
      const html = await response.text()
      expect(html).toContain(`href="${changed}"`)
      expect(html).not.toContain('https://x.com/jece9925')
      if (path === '/about') expect(html).toContain('@updated_account')
    }
    const home = (await (await request.get(`${publicBaseURL}/api/public/v1/home-aggregate`)).json()).data
    expect(home.hero.xContactUrl).toBe(changed)
    await page.goto(`${adminBaseURL}/admin/commissions`)
    const nav = page.getByRole('navigation', { name: '委托申请状态' })
    await nav.getByRole('link', { name: '已接受', exact: true }).click()
    await expect(nav.getByRole('link', { name: '已接受', exact: true })).toHaveAttribute('aria-current', 'page')
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 })
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBeTruthy()
      await page.screenshot({ path: `agent_docs/需求7-公开站中英切换/artifacts/screenshots/admin-commissions-${width}.png` })
    }
  }
  finally {
    const latest = (await (await page.request.get(endpoint)).json()).data
    const payload = { ...initial.contact, officialChannels: initial.contact.officialChannels.map(({ platform, account, qrCodeAssetId }: { platform: string, account: string | null, qrCodeAssetId: string | null }) => ({ platform, account, qrCodeAssetId })) }
    delete payload.smtpStatus
    expect((await page.request.put(`${endpoint}/contact`, { headers, data: { expectedVersion: latest.sectionVersions.contact, payload } })).status()).toBe(200)
  }
})
