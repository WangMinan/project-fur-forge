import {
  describe,
  expect,
  it,
} from 'vitest'
import {
  buildSiteDisplayProcess,
  siteDisplayHeight,
  siteDisplayWidths,
} from '../../server/utils/recipe/site-display-recipe'
import type { AssetSource } from '../../server/utils/recipe/media-source'

const source: AssetSource = {
  byteSize: 1024,
  cropHeight: 1,
  cropWidth: 1,
  cropX: 0,
  cropY: 0,
  focalX: 0.5,
  focalY: 0.5,
  height: 2250,
  id: 'hero-source',
  mimeType: 'image/png',
  privateObjectKey: 'test/original/hero.png',
  role: 'home_hero_landscape',
  sha256: 'a'.repeat(64),
  status: 'READY',
  width: 4000,
}

describe('site-display-v2 recipe', () => {
  it('adds 2K and 4K landscape hero sources without changing smaller widths', () => {
    expect(siteDisplayWidths('home-hero-landscape'))
      .toEqual([768, 1280, 1920, 2880, 3840])
    expect(siteDisplayHeight('home-hero-landscape', 2880)).toBe(1620)
    expect(siteDisplayHeight('home-hero-landscape', 3840)).toBe(2160)
  })

  it('uses q90 WebP for heroes and keeps the entry recipe at q82', () => {
    expect(buildSiteDisplayProcess(
      source,
      'home-hero-landscape',
      3840,
      'webp',
    )).toContain('quality,q_90/format,webp')
    expect(buildSiteDisplayProcess(
      source,
      'home-entry-commission',
      1080,
      'webp',
    )).toContain('quality,q_82/format,webp')
    expect(buildSiteDisplayProcess(
      source,
      'home-hero-landscape',
      3840,
      'jpeg',
    )).toContain('quality,q_86/format,jpg')
  })
})
