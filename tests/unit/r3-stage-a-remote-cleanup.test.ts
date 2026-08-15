import { describe, expect, it, vi } from 'vitest'
import type { PublicMediaCache } from '../../server/utils/public-media-cache'
import { R3StageAEsaCachePurger } from '../../server/utils/r3-stage-a-remote-cleanup'

const URL = 'https://media.example.test/test/r3-a-drill/review-001/web/retired.webp'

function cache(status: 'Complete' | 'Failed' = 'Complete') {
  return {
    enabled: true,
    mediaOrigin: 'https://media.example.test',
    describeExactFilePurge: vi.fn(async () => status),
    purgeExactFiles: vi.fn(async () => 'task-1'),
  } satisfies PublicMediaCache
}

describe('R3-A ESA retirement verification', () => {
  it('requires the exact URL to be unreachable after a completed purge', async () => {
    const mediaCache = cache()
    const probe = vi.fn(async () => 404)
    await expect(new R3StageAEsaCachePurger(mediaCache, probe)
      .purgeExactWaitAndVerifyUnavailable([URL])).resolves.toBeUndefined()
    expect(mediaCache.purgeExactFiles).toHaveBeenCalledWith([URL])
    expect(probe).toHaveBeenCalledWith(URL, 'HEAD')
  })

  it('falls back to a bounded GET when HEAD is unsupported', async () => {
    const probe = vi.fn(async (_url: string, method: 'GET' | 'HEAD') => (
      method === 'HEAD' ? 405 : 410
    ))
    await expect(new R3StageAEsaCachePurger(cache(), probe)
      .purgeExactWaitAndVerifyUnavailable([URL])).resolves.toBeUndefined()
    expect(probe).toHaveBeenNthCalledWith(1, URL, 'HEAD')
    expect(probe).toHaveBeenNthCalledWith(2, URL, 'GET')
  })

  it('rejects a reachable URL or a failed purge task', async () => {
    await expect(new R3StageAEsaCachePurger(cache(), async () => 200)
      .purgeExactWaitAndVerifyUnavailable([URL]))
      .rejects.toThrow(/still reachable/)
    await expect(new R3StageAEsaCachePurger(cache('Failed'), async () => 404)
      .purgeExactWaitAndVerifyUnavailable([URL]))
      .rejects.toThrow(/failed purge task/)
  })
})
