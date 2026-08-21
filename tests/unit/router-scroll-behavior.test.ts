import { afterEach, describe, expect, it, vi } from 'vitest'
import routerOptions from '../../app/router.options'

const scrollBehavior = routerOptions.scrollBehavior
type RouteLocation = Parameters<typeof scrollBehavior>[0]

function route(fullPath: string, hash = '') {
  return {
    fullPath,
    hash,
    path: fullPath.split(/[?#]/u)[0],
  } as RouteLocation
}

afterEach(() => vi.unstubAllGlobals())

describe('public router scroll behavior', () => {
  it('places new non-hash navigation at the page top after loading', async () => {
    let finishPageLoad: (() => void) | undefined
    vi.stubGlobal('document', {
      documentElement: { classList: { remove: vi.fn() } },
    })
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

    const positioned = scrollBehavior(route('/works'), route('/'), null)
    expect(positioned).toBeInstanceOf(Promise)
    finishPageLoad?.()

    await expect(positioned).resolves.toEqual({ left: 0, top: 0 })
  })

  it('places repeated non-hash navigation at the page top immediately', () => {
    expect(scrollBehavior(route('/'), route('/'), null))
      .toEqual({ left: 0, top: 0 })
  })

  it('disables homepage scroll snap before leaving it', () => {
    const remove = vi.fn()
    let finishPageLoad: (() => void) | undefined
    vi.stubGlobal('document', {
      documentElement: { classList: { remove } },
    })
    vi.stubGlobal('useNuxtApp', () => ({
      hooks: {
        hookOnce: (_name: string, callback: () => void) => {
          finishPageLoad = callback
        },
      },
    }))

    scrollBehavior(route('/works'), route('/'), null)

    expect(remove).toHaveBeenCalledWith('home-scroll-navigation')
    expect(finishPageLoad).toBeTypeOf('function')
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
    const documentElement = { classList: { remove: vi.fn() } }
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
