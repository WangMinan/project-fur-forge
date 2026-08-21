import { afterEach, describe, expect, it, vi } from 'vitest'
import routerOptions from '../../app/router.options'

const scrollBehavior = routerOptions.scrollBehavior
type RouteLocation = Parameters<typeof scrollBehavior>[0]

function route(fullPath: string, hash = '') {
  return { fullPath, hash } as RouteLocation
}

afterEach(() => vi.unstubAllGlobals())

describe('public router scroll behavior', () => {
  it('places new and repeated non-hash navigation at the page top', () => {
    expect(scrollBehavior(route('/works'), route('/'), null))
      .toEqual({ left: 0, top: 0 })
    expect(scrollBehavior(route('/'), route('/'), null))
      .toEqual({ left: 0, top: 0 })
  })

  it('restores back and forward navigation after the page is ready', async () => {
    const savedPosition = { left: 0, top: 2484 }
    let finishPageLoad: (() => void) | undefined
    vi.stubGlobal('useNuxtApp', () => ({
      hooks: {
        hookOnce: (_name: string, callback: () => void) => {
          finishPageLoad = callback
        },
      },
    }))
    vi.stubGlobal('requestAnimationFrame', (callback: FrameRequestCallback) => {
      callback(0)
      return 1
    })

    const restored = scrollBehavior(route('/'), route('/works'), savedPosition)
    expect(restored).toBeInstanceOf(Promise)
    expect(finishPageLoad).toBeTypeOf('function')
    finishPageLoad?.()

    await expect(restored).resolves.toBe(savedPosition)
  })

  it('keeps hash navigation below the shared header offset', () => {
    const documentElement = {}
    const target = {}
    vi.stubGlobal('document', {
      documentElement,
      querySelector: vi.fn(() => target),
    })
    vi.stubGlobal('getComputedStyle', (element: unknown) => (
      element === documentElement
        ? { scrollPaddingTop: '88px' }
        : { scrollMarginTop: '12px' }
    ))

    expect(scrollBehavior(route('/about#contact', '#contact'), route('/'), null))
      .toEqual({ el: '#contact', top: 100 })
  })
})
