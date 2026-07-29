import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { publicWorkDtoSchema } from '../../shared/schemas/work'
import { findWorkBySlug, workCatalog } from '../../shared/fixtures/visual-works'
import { featuredWorkSlugs } from '../../shared/fixtures/visual-home'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

describe('visual works catalog fixtures', () => {
  it('keeps every work DTO inside the public contract', () => {
    for (const work of workCatalog) {
      const result = publicWorkDtoSchema.safeParse(work.dto)
      expect(
        result.success,
        `${work.dto.slug} should satisfy publicWorkDtoSchema`,
      ).toBe(true)
    }
  })

  it('keeps the manual list order aligned with the home featured order', () => {
    expect(workCatalog.map(work => work.dto.slug)).toEqual([...featuredWorkSlugs])
  })

  it('only exposes price on adoption works with CNY minor units', () => {
    for (const work of workCatalog) {
      if (work.dto.purpose === 'adoption') {
        expect(work.dto.price?.currency).toBe('CNY')
        expect(Number.isInteger(work.dto.price?.minorUnits)).toBe(true)
      }
      else {
        expect('price' in work.dto && work.dto.price !== undefined).toBe(false)
      }
    }
  })

  it('declares card media at the recipe-v1 3:4 ratio', () => {
    for (const work of workCatalog) {
      expect(
        work.card.width * 4,
        `${work.dto.slug} card should be 3:4`,
      ).toBe(work.card.height * 3)
    }
  })

  it('keeps galleries ordered, bounded and backed by on-disk media', () => {
    for (const work of workCatalog) {
      expect(work.gallery.length).toBeGreaterThanOrEqual(1)
      expect(work.gallery.length).toBeLessThanOrEqual(5)

      const media = [work.card, ...work.gallery]
      for (const item of media) {
        expect(item.src.startsWith('/fixtures/')).toBe(true)
        expect(
          existsSync(join(publicDir, item.src)),
          `fixture media should exist: ${item.src}`,
        ).toBe(true)
        expect(item.focal.desktop).toMatch(/^\d+% \d+%$/)
        expect(item.focal.mobile).toMatch(/^\d+% \d+%$/)
        expect(item.alt.length).toBeGreaterThan(0)
        expect(item.width).toBeGreaterThan(0)
        expect(item.height).toBeGreaterThan(0)
      }
    }
  })

  it('marks sample photos as internal development samples only', () => {
    const sampleWorks = workCatalog.filter(work => work.mediaOrigin === 'sample-photo')
    expect(sampleWorks.length).toBeGreaterThanOrEqual(2)

    for (const work of sampleWorks) {
      for (const media of [work.card, ...work.gallery]) {
        expect(media.src.startsWith('/fixtures/samples/')).toBe(true)
        expect(media.alt).toContain('内部开发样张')
      }
    }
  })

  it('resolves every slug through findWorkBySlug', () => {
    for (const work of workCatalog) {
      expect(findWorkBySlug(work.dto.slug)?.dto.id).toBe(work.dto.id)
    }
    expect(findWorkBySlug('not-a-work')).toBeUndefined()
  })
})
