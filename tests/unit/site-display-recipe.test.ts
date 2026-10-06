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
  it('crops both Hero placements continuously and uses the actual processing source dimensions', () => {
    for (const placement of ['home', 'commission'] as const) {
      const landscape = { ...source, height: 3000, focalX: 0.37, focalY: 0.64 }
      expect(buildSiteDisplayProcess(landscape, `${placement}-hero-landscape`, 1920, 'webp'))
        .toContain('crop,x_0,y_480,w_4000,h_2250/resize,m_fill,w_1920,h_1080')
      expect(buildSiteDisplayProcess({ ...landscape, focalY: 0.65 }, `${placement}-hero-landscape`, 1920, 'webp'))
        .toContain('crop,x_0,y_488,')
      const portrait = { ...source, width: 1600, height: 2400, focalX: 0.4, focalY: 0.64 }
      expect(buildSiteDisplayProcess(portrait, `${placement}-hero-portrait`, 1080, 'webp'))
        .toContain('crop,x_100,y_0,w_1350,h_2400/')
      expect(buildSiteDisplayProcess(portrait, `${placement}-hero-portrait`, 1080, 'webp', { width: 800, height: 1200 }))
        .toContain('crop,x_50,y_0,w_675,h_1200/')
      for (const focalX of [0, 1]) {
        expect(buildSiteDisplayProcess({ ...portrait, focalX }, `${placement}-hero-portrait`, 1080, 'webp'))
          .toContain(`crop,x_${focalX * 250},y_0,w_1350,h_2400/`)
      }
    }
  })

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
