import { expect, test } from '@playwright/test'
import { publicBaseURL } from './helpers/auth'
import { seedPublicCatalog } from './helpers/public-catalog'
import type { SeedWork } from './helpers/public-catalog'

const SEO_WORKS: SeedWork[] = [
  {
    slug: 'e2e-public-seo-work',
    characterName: '星糖',
    species: '狐狸',
    purpose: 'showcase',
    sortOrder: 0,
    photos: [{ alt: '星糖的出厂照' }],
  },
  {
    slug: 'e2e-public-seo-adoption',
    characterName: '月饼',
    species: '小狗',
    purpose: 'adoption',
    adoptionStatus: 'available',
    sortOrder: 1,
    adoptionCover: { alt: '月饼的独立横版领养封面', width: 1920, height: 1080 },
    designSheet: { alt: '月饼的完整设定图' },
    photos: [{ alt: '月饼的出厂照' }],
  },
]

test('公开页输出 canonical、分享元数据与可见事实 JSON-LD', async ({ page }) => {
  await seedPublicCatalog(page, SEO_WORKS)
  await page.goto('/works/e2e-public-seo-work')

  await expect(page.locator('link[rel="canonical"]')).toHaveAttribute(
    'href',
    `${publicBaseURL}/works/e2e-public-seo-work`,
  )
  await expect(page.locator('meta[property="og:image"]')).toHaveAttribute(
    'content',
    `${publicBaseURL}/brand/og-default.png`,
  )
  await expect(page.locator('meta[name="twitter:card"]')).toHaveAttribute(
    'content',
    'summary_large_image',
  )

  const structuredData = await page.locator('script[type="application/ld+json"]')
    .allTextContents()
  const records = structuredData.map(value => JSON.parse(value) as Record<string, unknown>)
  expect(records.some(record =>
    record['@type'] === 'Organization' && record.name === '有点小狗工作室',
  )).toBe(true)
  expect(records.some(record =>
    record['@type'] === 'CreativeWork' && record.name === '星糖',
  )).toBe(true)
  expect(structuredData.join('')).not.toContain('ownerContact')
})

test('sitemap 与 robots 只列公开路径，图标尺寸可核对', async ({ request }) => {
  const sitemapResponse = await request.get('/sitemap.xml')
  expect(sitemapResponse.status()).toBe(200)
  expect(sitemapResponse.headers()['content-type']).toContain('application/xml')
  const sitemap = await sitemapResponse.text()
  for (const path of [
    '/',
    '/works',
    '/commission',
    '/adoptions',
    '/about',
    '/service',
    '/privacy',
    '/works/e2e-public-seo-work',
    '/works/e2e-public-seo-adoption',
  ]) {
    expect(sitemap).toContain(`<loc>${new URL(path, publicBaseURL).href}</loc>`)
  }
  expect(sitemap).not.toContain('/admin')
  expect(sitemap).not.toContain('/api/')
  expect(sitemap).not.toContain('/returns')
  expect(sitemap).not.toContain('/updates')
  expect(sitemap).not.toContain('/contact')
  expect(sitemap).not.toContain('/terms')

  const robots = await (await request.get('/robots.txt')).text()
  expect(robots).toContain('Disallow: /admin/')
  expect(robots).toContain('Disallow: /api/')
  expect(robots).toContain(`Sitemap: ${publicBaseURL}/sitemap.xml`)

  for (const [path, width, height] of [
    ['/brand/favicon-dark-16.png', 16, 16],
    ['/brand/favicon-dark-32.png', 32, 32],
    ['/brand/favicon-light-16.png', 16, 16],
    ['/brand/favicon-light-32.png', 32, 32],
    ['/brand/apple-touch-icon.png', 180, 180],
    ['/brand/og-default.png', 1200, 630],
  ] as const) {
    const response = await request.get(path)
    expect(response.status()).toBe(200)
    const png = await response.body()
    expect(png.subarray(1, 4).toString('ascii')).toBe('PNG')
    expect(png.readUInt32BE(16)).toBe(width)
    expect(png.readUInt32BE(20)).toBe(height)
  }
})
