import { describe, expect, it } from 'vitest'
import {
  assertExactPublicMediaUrls,
  MAX_EDGE_PURGE_FILES,
} from '../../server/utils/public-media-cache'
import { edgePurgeUrlsForObjectKeys } from '../../server/utils/runner/public-media-purge'
import { FakePublicMediaCache } from '../helpers/fake-public-media-cache'

describe('public media edge purge contract', () => {
  const mediaOrigin = 'https://public-media.ditedog.com'

  it('accepts only exact production media files', () => {
    expect(() => assertExactPublicMediaUrls([
      'https://public-media.ditedog.com/prod/web/asset/work-card.webp',
    ], mediaOrigin)).not.toThrow()

    for (const value of [
      'https://project-furry-forge-public.oss-cn-hangzhou.aliyuncs.com/prod/web/asset/work-card.webp',
      'https://public-media.ditedog.com/prod/original/asset/source.png',
      'https://public-media.ditedog.com/prod/web/asset/work-card.webp?cache=1',
      'https://public-media.ditedog.com/prod/web/',
    ]) {
      expect(() => assertExactPublicMediaUrls([value], mediaOrigin)).toThrow(/exact production media file/)
    }
  })

  it('rejects duplicate and over-limit batches', () => {
    const url = 'https://public-media.ditedog.com/prod/web/asset/work-card.webp'
    expect(() => assertExactPublicMediaUrls([url, url], mediaOrigin)).toThrow(/unique/)
    expect(() => assertExactPublicMediaUrls(Array.from(
      { length: MAX_EDGE_PURGE_FILES + 1 },
      (_, index) => `https://public-media.ditedog.com/prod/web/asset/${index}.webp`,
    ), mediaOrigin)).toThrow(/1000/)
  })

  it('builds encoded exact URLs from immutable public object keys', () => {
    const cache = new FakePublicMediaCache()
    expect(edgePurgeUrlsForObjectKeys(cache, [
      'prod/web/asset/犬 科.webp',
    ])).toEqual([
      'https://public-media.ditedog.com/prod/web/asset/%E7%8A%AC%20%E7%A7%91.webp',
    ])
  })
})
