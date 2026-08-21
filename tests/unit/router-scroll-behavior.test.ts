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

function stubPageLoad() {
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
  return () => finishPageLoad?.()
}

describe('public router scroll behavior', () => {
  it('leaves homepage snap and places a new page at the top after loading', async () => {
    const remove = vi.fn()
    vi.stubGlobal('document', { documentElement: { classList: { remove } } })
    const finishPageLoad = stubPageLoad()

    const positioned = scrollBehavior(route('/works'), route('/'), null)

    expect(positioned).toBeInstanceOf(Promise)
    expect(remove).toHaveBeenCalledWith('home-scroll-navigation')
    finishPageLoad()
    await expect(positioned).resolves.toEqual({ left: 0, top: 0 })
  })

  it('restores back and forward navigation after the page is ready', async () => {
    const savedPosition = { left: 0, top: 2484 }
    const finishPageLoad = stubPageLoad()

    const restored = scrollBehavior(route('/'), route('/works'), savedPosition)

    expect(restored).toBeInstanceOf(Promise)
    finishPageLoad()
    await expect(restored).resolves.toBe(savedPosition)
  })

  it('handles repeated and hash navigation synchronously', () => {
    expect(scrollBehavior(route('/'), route('/'), null))
      .toEqual({ left: 0, top: 0 })

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
