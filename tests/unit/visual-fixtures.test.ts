import { existsSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import {
  businessStatusFixtures,
  routeCardFixtures,
} from '../../shared/fixtures/visual-home'

const publicDir = fileURLToPath(new URL('../../public', import.meta.url))

function expectMediaFile(src: string) {
  expect(
    existsSync(join(publicDir, src)),
    `fixture media should exist: ${src}`,
  ).toBe(true)
}

describe('visual home fixtures', () => {
  it('references only on-disk fixture media, never network URLs', () => {
    const mediaSrcs = routeCardFixtures.map(card => card.media.src)

    for (const src of mediaSrcs) {
      expect(src.startsWith('/fixtures/')).toBe(true)
      expectMediaFile(src)
    }
  })

  it('provides independent desktop and mobile focal points', () => {
    const media = routeCardFixtures.map(card => card.media)

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
