import {
  createRenderer,
  defineComponent,
  nextTick,
  shallowRef,
} from 'vue'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'
import { useCarouselPlayback } from '../../app/composables/useCarouselPlayback'
import { animateDirectionalLayers } from '../../app/utils/hero-carousel'

afterEach(() => {
  vi.useRealTimers()
  vi.unstubAllGlobals()
})

describe('shared carousel behavior', () => {
  it('runs every four seconds and stops when disabled, hidden or reduced', async () => {
    vi.useFakeTimers()
    let hidden = false
    let motionListener: ((event: MediaQueryListEvent) => void) | null = null
    let visibilityListener: (() => void) | null = null
    const mediaQuery = {
      matches: false,
      addEventListener: (_type: string, listener: (event: MediaQueryListEvent) => void) => {
        motionListener = listener
      },
      removeEventListener: () => {
        motionListener = null
      },
    } as unknown as MediaQueryList
    vi.stubGlobal('matchMedia', () => mediaQuery)
    vi.stubGlobal('document', {
      get hidden() {
        return hidden
      },
      addEventListener: (_type: string, listener: () => void) => {
        visibilityListener = listener
      },
      removeEventListener: () => {
        visibilityListener = null
      },
    })

    const renderer = createRenderer<object, object>({
      patchProp() {},
      insert() {},
      remove() {},
      createElement: () => ({}),
      createText: () => ({}),
      createComment: () => ({}),
      setText() {},
      setElementText() {},
      parentNode: () => null,
      nextSibling: () => null,
    })
    const enabled = shallowRef(true)
    const advance = vi.fn()
    const app = renderer.createApp(defineComponent({
      setup() {
        useCarouselPlayback({
          advance,
          enabled: () => enabled.value,
        })
        return () => null
      },
    }))

    app.mount({})
    await vi.advanceTimersByTimeAsync(4_000)
    expect(advance).toHaveBeenCalledTimes(1)

    enabled.value = false
    await nextTick()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(advance).toHaveBeenCalledTimes(1)

    enabled.value = true
    await nextTick()
    hidden = true
    visibilityListener?.()
    await nextTick()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(advance).toHaveBeenCalledTimes(1)

    hidden = false
    visibilityListener?.()
    await nextTick()
    motionListener?.({ matches: true } as MediaQueryListEvent)
    await nextTick()
    await vi.advanceTimersByTimeAsync(4_000)
    expect(advance).toHaveBeenCalledTimes(1)
    app.unmount()
  })

  it('animates only present layers in the requested direction', async () => {
    const cancel = vi.fn()
    const animation = {
      cancel,
      finished: Promise.resolve(),
    } as unknown as Animation
    const animate = vi.fn(() => animation)
    const element = { animate } as unknown as HTMLElement

    expect(animateDirectionalLayers([
      { element, delay: 10, distance: 12, duration: 200 },
      { element: null, delay: 0, distance: 8, duration: 100 },
    ], -1, 'linear')).toEqual([animation])
    expect(animate).toHaveBeenCalledWith(
      [
        { opacity: 0.001, transform: 'translate3d(-12px, 0, 0)' },
        { opacity: 1, transform: 'translate3d(0, 0, 0)' },
      ],
      { delay: 10, duration: 200, easing: 'linear', fill: 'both' },
    )
    await animation.finished
    expect(cancel).toHaveBeenCalledOnce()
  })
})
