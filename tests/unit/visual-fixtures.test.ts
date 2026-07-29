import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publicWorkDtoSchema } from '../../shared/schemas/work'
import {
  businessStatusFixtures,
  featuredWorkSlugs,
  heroFixture,
  routeCardFixtures,
  visualWorkFixtures,
} from '../../shared/fixtures/visual-home'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

function expectMediaFile(src: string) {
  expect(
    existsSync(join(publicDir, src)),
    `fixture media should exist: ${src}`,
  ).toBe(true)
}

describe('visual home fixtures', () => {
  it('keeps every work DTO inside the public contract', () => {
    for (const work of visualWorkFixtures) {
      const result = publicWorkDtoSchema.safeParse(work.dto)
      expect(
        result.success,
        `${work.dto.slug} should satisfy publicWorkDtoSchema`,
      ).toBe(true)
    }
  })

  it('only exposes price on adoption works with CNY minor units', () => {
    for (const work of visualWorkFixtures) {
      if (work.dto.purpose === 'adoption') {
        expect(work.dto.price?.currency).toBe('CNY')
        expect(Number.isInteger(work.dto.price?.minorUnits)).toBe(true)
      }
      else {
        expect('price' in work.dto && work.dto.price !== undefined).toBe(false)
      }
    }
  })

  it('keeps featured selection manual, unique and within 3–6 works', () => {
    expect(featuredWorkSlugs.length).toBeGreaterThanOrEqual(3)
    expect(featuredWorkSlugs.length).toBeLessThanOrEqual(6)
    expect(new Set(featuredWorkSlugs).size).toBe(featuredWorkSlugs.length)

    for (const slug of featuredWorkSlugs) {
      expect(
        visualWorkFixtures.some(work => work.dto.slug === slug),
        `featured slug should resolve: ${slug}`,
      ).toBe(true)
    }
  })

  it('references only on-disk fixture media, never network URLs', () => {
    const mediaSrcs = [
      heroFixture.media.src,
      ...visualWorkFixtures.map(work => work.card.src),
      ...routeCardFixtures.map(card => card.media.src),
    ]

    for (const src of mediaSrcs) {
      expect(src.startsWith('/fixtures/')).toBe(true)
      expectMediaFile(src)
    }
  })

  it('provides independent desktop and mobile focal points', () => {
    const media = [
      heroFixture.media,
      ...visualWorkFixtures.map(work => work.card),
      ...routeCardFixtures.map(card => card.media),
    ]

    for (const item of media) {
      expect(item.focal.desktop).toMatch(/^\d+% \d+%$/)
      expect(item.focal.mobile).toMatch(/^\d+% \d+%$/)
      expect(item.width).toBeGreaterThan(0)
      expect(item.height).toBeGreaterThan(0)
    }
  })

  it('keeps business statuses separate from single-work states', () => {
    expect(businessStatusFixtures.map(status => status.kind).sort()).toEqual([
      'adoption',
      'commission',
    ])
    for (const status of businessStatusFixtures) {
      expect(['open', 'paused', 'neutral']).toContain(status.tone)
      expect(status.href.startsWith('/')).toBe(true)
    }
  })
})
